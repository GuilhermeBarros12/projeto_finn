import { Prisma, type Category, type Transaction } from "../../generated/prisma/client";
import { AppError } from "../lib/app-error";
import { prisma } from "../lib/prisma";
import type {
  CreateTransactionInput,
  TransactionFilterInput,
  TransactionListInput,
  UpdateTransactionInput,
} from "../schemas/transaction.schema";

export type TransactionWithCategory = Prisma.TransactionGetPayload<{
  include: { category: { select: { id: true; name: true; icon: true; color: true } } };
}>;

export interface PaginatedTransactions {
  data: TransactionWithCategory[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

const EXPORT_BATCH_SIZE = 500;
const WITH_CATEGORY = {
  category: { select: { id: true, name: true, icon: true, color: true } },
} as const;
const NEWEST_FIRST: Prisma.TransactionOrderByWithRelationInput[] = [
  { date: "desc" },
  { createdAt: "desc" },
  { id: "desc" },
];

export class TransactionService {
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

  async create(userId: string, input: CreateTransactionInput): Promise<Transaction> {
    await this.validateCategoryAndType(userId, input.categoryId, input.type);
    return prisma.transaction.create({ data: { ...input, userId } });
  }

  async list(userId: string, input: TransactionListInput): Promise<PaginatedTransactions> {
    const where = this.buildWhere(userId, input);

    const [data, total] = await prisma.$transaction([
      prisma.transaction.findMany({
        where,
        orderBy: NEWEST_FIRST,
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        include: WITH_CATEGORY,
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
        include: WITH_CATEGORY,
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

    return prisma.transaction.update({ where: { id: transaction.id }, data: input });
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
