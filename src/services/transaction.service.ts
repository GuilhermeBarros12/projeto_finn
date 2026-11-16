import { randomUUID } from "node:crypto";
import { Prisma, type Category, type Transaction } from "../../generated/prisma/client";
import { AppError } from "../lib/app-error";
import { addMonthsKeepingDay } from "../lib/billing-calendar";
import { prisma } from "../lib/prisma";
import type {
  CreateTransactionInput,
  TransactionFilterInput,
  TransactionListInput,
  UpdateTransactionInput,
} from "../schemas/transaction.schema";
import { CardService } from "./card.service";

export type TransactionWithCategory = Prisma.TransactionGetPayload<{
  include: {
    category: { select: { id: true; name: true; icon: true; color: true } };
    card: { select: { id: true; name: true } };
  };
}>;

export interface PaginatedTransactions {
  data: TransactionWithCategory[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

const EXPORT_BATCH_SIZE = 500;
const WITH_RELATIONS = {
  category: { select: { id: true, name: true, icon: true, color: true } },
  card: { select: { id: true, name: true } },
} as const;
const RECURRENCE_MONTHS = 12;
const NEWEST_FIRST: Prisma.TransactionOrderByWithRelationInput[] = [
  { date: "desc" },
  { createdAt: "desc" },
  { id: "desc" },
];

/** Divide em centavos: no modo total o centavo que sobra vai para a primeira parcela. */
const installmentCents = (
  input: NonNullable<CreateTransactionInput["installments"]>,
  value: number,
): number[] => {
  const cents = Math.round(value * 100);

  if (input.valueMode === "PER_INSTALLMENT") {
    return Array.from({ length: input.count }, () => cents);
  }

  if (cents < input.count) {
    throw new AppError("O valor total não cobre uma parcela mínima de R$ 0,01.", 422);
  }

  const base = Math.floor(cents / input.count);
  return Array.from({ length: input.count }, (_, index) =>
    index === 0 ? base + (cents - base * input.count) : base,
  );
};

const toDecimal = (cents: number): Prisma.Decimal => new Prisma.Decimal(cents).div(100);

export class TransactionService {
  constructor(private readonly cardService = new CardService()) {}

  /** Cartão informado (validado) ou o padrão; só existe quando a origem é cartão de crédito. */
  private async resolveCardId(
    userId: string,
    paymentMethod: string,
    cardId: string | undefined,
  ): Promise<string | null> {
    if (paymentMethod !== "CREDIT_CARD") return null;
    if (cardId) return (await this.cardService.getUsableCard(userId, cardId)).id;

    const card = await this.cardService.getDefaultCard(userId);
    if (!card) throw new AppError("Cadastre um cartão de crédito antes de lançar no crédito.", 422);
    return card.id;
  }

  private async getUsableCategory(userId: string, categoryId: string): Promise<Category> {
    const category = await prisma.category.findFirst({
      where: { id: categoryId, status: true, OR: [{ userId: null }, { userId }] },
    });

    if (!category) {
      throw new AppError(
        "Categoria não encontrada, inativa ou não permitida para este usuário.",
        422,
      );
    }

    return category;
  }

  private async validateCategoryAndType(
    userId: string,
    categoryId: string,
    type: string,
  ): Promise<void> {
    const category = await this.getUsableCategory(userId, categoryId);

    if (category.type !== type) {
      throw new AppError("O tipo da transação deve ser igual ao tipo da categoria.", 422);
    }
  }

  private buildWhere(userId: string, input: TransactionFilterInput): Prisma.TransactionWhereInput {
    const where: Prisma.TransactionWhereInput = { userId };

    if (input.categoryId) where.categoryId = input.categoryId;
    if (input.type) where.type = input.type;
    if (input.paymentMethod) where.paymentMethod = input.paymentMethod;
    if (input.cardId) where.cardId = input.cardId;
    if (input.origin === "CREDIT_CARD") where.paymentMethod = "CREDIT_CARD";
    if (input.origin === "ACCOUNT") {
      where.paymentMethod = { in: ["PIX", "DEBIT_CARD", "CASH", "BANK_TRANSFER", "OTHER"] };
    }

    if (input.date) {
      const start = new Date(`${input.date}T00:00:00.000Z`);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);
      where.date = { gte: start, lt: end };
    } else if (input.month !== undefined && input.year !== undefined) {
      const start = new Date(Date.UTC(input.year, input.month - 1, 1));
      const end = new Date(Date.UTC(input.year, input.month, 1));
      where.date = { gte: start, lt: end };
    } else if (input.year !== undefined) {
      const start = new Date(Date.UTC(input.year, 0, 1));
      const end = new Date(Date.UTC(input.year + 1, 0, 1));
      where.date = { gte: start, lt: end };
    }

    return where;
  }

  async create(userId: string, input: CreateTransactionInput): Promise<TransactionWithCategory[]> {
    await this.validateCategoryAndType(userId, input.categoryId, input.type);
    const cardId = await this.resolveCardId(userId, input.paymentMethod, input.cardId);

    const base = {
      userId,
      categoryId: input.categoryId,
      type: input.type,
      description: input.description,
      paymentMethod: input.paymentMethod,
      cardId,
    };

    if (input.mode === "INSTALLMENTS" && input.installments) {
      const cents = installmentCents(input.installments, input.value);
      const installmentGroupId = randomUUID();

      return prisma.$transaction(async (tx) => {
        const created: TransactionWithCategory[] = [];
        for (const [index, amount] of cents.entries()) {
          created.push(
            await tx.transaction.create({
              data: {
                ...base,
                date: addMonthsKeepingDay(input.date, index),
                value: toDecimal(amount),
                installmentGroupId,
                installmentNumber: index + 1,
                installmentCount: cents.length,
              },
              include: WITH_RELATIONS,
            }),
          );
        }
        return created;
      });
    }

    if (input.mode === "RECURRING") {
      const endDate = input.recurrence?.endDate ?? null;
      const dates: Date[] = [];
      for (let month = 0; month < RECURRENCE_MONTHS; month += 1) {
        const date = addMonthsKeepingDay(input.date, month);
        if (endDate && date > endDate) break;
        dates.push(date);
      }

      return prisma.$transaction(async (tx) => {
        const recurrence = await tx.recurrence.create({ data: { userId, endDate } });
        const created: TransactionWithCategory[] = [];
        for (const date of dates) {
          created.push(
            await tx.transaction.create({
              data: { ...base, date, value: input.value, recurrenceId: recurrence.id },
              include: WITH_RELATIONS,
            }),
          );
        }
        return created;
      });
    }

    return [
      await prisma.transaction.create({
        data: { ...base, date: input.date, value: input.value },
        include: WITH_RELATIONS,
      }),
    ];
  }

  async list(userId: string, input: TransactionListInput): Promise<PaginatedTransactions> {
    const where = this.buildWhere(userId, input);

    const [data, total] = await prisma.$transaction([
      prisma.transaction.findMany({
        where,
        orderBy: NEWEST_FIRST,
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        include: WITH_RELATIONS,
      }),
      prisma.transaction.count({ where }),
    ]);

    return {
      data,
      meta: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: Math.ceil(total / input.limit),
      },
    };
  }

  /** Percorre tudo em lotes com cursor, para exportar sem carregar o histórico na memória. */
  async *iterate(
    userId: string,
    filters: TransactionFilterInput,
  ): AsyncGenerator<TransactionWithCategory> {
    const where = this.buildWhere(userId, filters);
    let cursor: string | undefined;

    while (true) {
      const batch = await prisma.transaction.findMany({
        where,
        orderBy: NEWEST_FIRST,
        take: EXPORT_BATCH_SIZE,
        include: WITH_RELATIONS,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

      yield* batch;

      const last = batch.at(-1);
      if (!last || batch.length < EXPORT_BATCH_SIZE) return;
      cursor = last.id;
    }
  }

  async update(
    userId: string,
    transactionId: string,
    input: UpdateTransactionInput,
  ): Promise<Transaction> {
    const transaction = await prisma.transaction.findFirst({
      where: { id: transactionId, userId },
    });

    if (!transaction) {
      throw new AppError("Transação não encontrada.", 404);
    }

    const categoryId = input.categoryId ?? transaction.categoryId;
    const type = input.type ?? transaction.type;

    // Só revalida o que mudou: desativar uma categoria não pode congelar o histórico dela.
    if (categoryId !== transaction.categoryId || type !== transaction.type) {
      await this.validateCategoryAndType(userId, categoryId, type);
    }

    const paymentMethod = input.paymentMethod ?? transaction.paymentMethod;
    let cardId: string | null = transaction.cardId;

    if (paymentMethod !== "CREDIT_CARD") {
      cardId = null;
    } else if (input.cardId && input.cardId !== transaction.cardId) {
      cardId = (await this.cardService.getUsableCard(userId, input.cardId)).id;
    } else if (!cardId) {
      cardId = await this.resolveCardId(userId, paymentMethod, undefined);
    }

    return prisma.transaction.update({
      where: { id: transaction.id },
      data: { ...input, cardId },
    });
  }

  async delete(userId: string, transactionId: string): Promise<void> {
    const transaction = await prisma.transaction.findFirst({
      where: { id: transactionId, userId },
    });

    if (!transaction) {
      throw new AppError("Transação não encontrada.", 404);
    }

    await prisma.transaction.delete({ where: { id: transaction.id } });
  }
}
