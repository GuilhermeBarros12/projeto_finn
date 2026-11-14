import { Prisma, type Goal } from "../../generated/prisma/client";
import { AppError } from "../lib/app-error";
import { addUtcDays, calendarDay } from "../lib/dates";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import type { CreateGoalInput, GoalListInput, UpdateGoalInput } from "../schemas/goal.schema";

const WITH_CATEGORY = { category: { select: { id: true, name: true, status: true } } } as const;

type GoalWithCategory = Prisma.GoalGetPayload<{ include: typeof WITH_CATEGORY }>;

export interface GoalWithProgress extends GoalWithCategory {
  currentValue: number;
  progress: number;
}

export interface PaginatedGoals {
  data: GoalWithProgress[];
  meta: { page: number; limit: number; total: number };
}

export class GoalService {
  private async validateCategory(
    userId: string,
    input: CreateGoalInput | UpdateGoalInput,
  ): Promise<void> {
    if (input.type !== "SPENDING_LIMIT" || !input.categoryId) return;

    const category = await prisma.category.findFirst({
      where: {
        id: input.categoryId,
        status: true,
        type: "EXPENSE",
        OR: [{ userId: null }, { userId }],
      },
    });

    if (!category) {
      throw new AppError("A categoria do limite deve ser uma despesa ativa e permitida.", 422);
    }
  }

  private async expireOverdue(userId: string): Promise<void> {
    await prisma.goal.updateMany({
      where: { userId, status: "IN_PROGRESS", dueDate: { lt: calendarDay(new Date()) } },
      data: { status: "EXPIRED" },
    });
  }

  /**
   * O período da meta vai do dia em que foi criada até o prazo, inclusive, e nunca passa de
   * hoje: lançamento com data futura é previsão e não conta como dinheiro guardado ou gasto.
   * Limite de gasto soma as despesas da categoria; economia soma receitas menos despesas.
   * Uma única consulta calcula todas as metas da página, em vez de uma consulta por meta.
   */
  private async currentValues(goals: Goal[]): Promise<Map<string, Prisma.Decimal>> {
    if (goals.length === 0) return new Map();

    const tomorrow = addUtcDays(calendarDay(new Date()), 1).toISOString().slice(0, 10);
    const rows = await prisma.$queryRaw<Array<{ id: string; income: unknown; expense: unknown }>>`
      SELECT g."id",
        COALESCE(SUM(t."value") FILTER (WHERE t."type" = 'INCOME'), 0) AS income,
        COALESCE(SUM(t."value") FILTER (WHERE t."type" = 'EXPENSE'), 0) AS expense
      FROM "Goal" g
      LEFT JOIN "Transaction" t
        ON t."userId" = g."userId"
        AND t."date" >= ((g."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${env.APP_TIMEZONE})::date
        AND t."date" < LEAST(g."dueDate" + INTERVAL '1 day', ${tomorrow}::date)
        AND (g."type" = 'SAVINGS' OR (t."type" = 'EXPENSE' AND t."categoryId" = g."categoryId"))
      WHERE g."id" IN (${Prisma.join(goals.map((goal) => goal.id))})
      GROUP BY g."id"
    `;

    const types = new Map(goals.map((goal) => [goal.id, goal.type]));

    return new Map(
      rows.map((row) => {
        const income = new Prisma.Decimal(String(row.income));
        const expense = new Prisma.Decimal(String(row.expense));
        if (types.get(row.id) === "SPENDING_LIMIT") return [row.id, expense];

        const saved = income.minus(expense);
        return [row.id, saved.isNegative() ? new Prisma.Decimal(0) : saved];
      }),
    );
  }

  private withProgress(goal: GoalWithCategory, currentValue: Prisma.Decimal): GoalWithProgress {
    return {
      ...goal,
      currentValue: currentValue.toNumber(),
      progress: currentValue.dividedBy(goal.targetValue).times(100).toDecimalPlaces(1).toNumber(),
    };
  }

  async create(userId: string, input: CreateGoalInput): Promise<Goal> {
    await this.validateCategory(userId, input);
    return prisma.goal.create({ data: { ...input, userId } });
  }

  async list(userId: string, input: GoalListInput): Promise<PaginatedGoals> {
    await this.expireOverdue(userId);

    const where: Prisma.GoalWhereInput = {
      userId,
      ...(input.status ? { status: input.status } : {}),
    };
    const [goals, total] = await prisma.$transaction([
      prisma.goal.findMany({
        where,
        // O id desempata prazos iguais, para nenhuma meta repetir ou sumir entre páginas.
        orderBy: [{ dueDate: "asc" }, { id: "asc" }],
        include: WITH_CATEGORY,
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
      prisma.goal.count({ where }),
    ]);
    const values = await this.currentValues(goals);

    return {
      data: goals.map((goal) =>
        this.withProgress(goal, values.get(goal.id) ?? new Prisma.Decimal(0)),
      ),
      meta: { page: input.page, limit: input.limit, total },
    };
  }

  async update(userId: string, id: string, input: UpdateGoalInput): Promise<Goal> {
    const goal = await prisma.goal.findFirst({ where: { id, userId } });
    if (!goal) throw new AppError("Meta não encontrada.", 404);

    // Só revalida se a categoria mudou: desativá-la não pode congelar as metas que já a usam.
    if (input.categoryId !== goal.categoryId) await this.validateCategory(userId, input);

    return prisma.goal.update({ where: { id }, data: input });
  }

  async delete(userId: string, id: string): Promise<void> {
    const result = await prisma.goal.deleteMany({ where: { id, userId } });
    if (!result.count) throw new AppError("Meta não encontrada.", 404);
  }
}
