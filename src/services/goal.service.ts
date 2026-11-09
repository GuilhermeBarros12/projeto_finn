import { Prisma, type Goal } from "../../generated/prisma/client";
import { AppError } from "../lib/app-error";
import { addUtcDays, calendarDay } from "../lib/dates";
import { prisma } from "../lib/prisma";
import type { CreateGoalInput, GoalListInput, UpdateGoalInput } from "../schemas/goal.schema";

export interface GoalWithProgress extends Goal {
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
   * O período da meta vai do dia em que foi criada até o prazo, inclusive.
   * Limite de gasto soma as despesas da categoria; economia soma receitas menos despesas.
   */
  private async currentValue(goal: Goal): Promise<Prisma.Decimal> {
    const where: Prisma.TransactionWhereInput = {
      userId: goal.userId,
      date: { gte: calendarDay(goal.createdAt), lt: addUtcDays(goal.dueDate, 1) },
    };

    if (goal.type === "SPENDING_LIMIT" && goal.categoryId) {
      const spent = await prisma.transaction.aggregate({
        where: { ...where, type: "EXPENSE", categoryId: goal.categoryId },
        _sum: { value: true },
      });
      return spent._sum.value ?? new Prisma.Decimal(0);
    }

    const groups = await prisma.transaction.groupBy({
      by: ["type"],
      where,
      _sum: { value: true },
    });
    const total = (type: "INCOME" | "EXPENSE"): Prisma.Decimal =>
      groups.find((group) => group.type === type)?._sum.value ?? new Prisma.Decimal(0);
    const saved = total("INCOME").minus(total("EXPENSE"));

    return saved.isNegative() ? new Prisma.Decimal(0) : saved;
  }

  private async withProgress(goal: Goal): Promise<GoalWithProgress> {
    const currentValue = await this.currentValue(goal);

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
        orderBy: { dueDate: "asc" },
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
      prisma.goal.count({ where }),
    ]);

    return {
      data: await Promise.all(goals.map((goal) => this.withProgress(goal))),
      meta: { page: input.page, limit: input.limit, total },
    };
  }

  async update(userId: string, id: string, input: UpdateGoalInput): Promise<Goal> {
    const goal = await prisma.goal.findFirst({ where: { id, userId } });
    if (!goal) throw new AppError("Meta não encontrada.", 404);

    await this.validateCategory(userId, input);
    return prisma.goal.update({ where: { id }, data: input });
  }

  async delete(userId: string, id: string): Promise<void> {
    const result = await prisma.goal.deleteMany({ where: { id, userId } });
    if (!result.count) throw new AppError("Meta não encontrada.", 404);
  }
}
