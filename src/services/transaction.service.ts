import { Prisma, type Category, type Transaction } from "../../generated/prisma/client";
import { AppError } from "../lib/app-error";
import { prisma } from "../lib/prisma";
import type {
  CreateTransactionInput,
  TransactionListInput,
  UpdateTransactionInput,
} from "../schemas/transaction.schema";

export interface PaginatedTransactions {
  data: Transaction[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export class TransactionService {
  private async getUsableCategory(userId: string, categoryId: string): Promise<Category> {
    const category = await prisma.category.findFirst({
      where: { id: categoryId, status: true, OR: [{ userId: null }, { userId }] },
    });

    if (!category) {
      throw new AppError("Categoria não encontrada, inativa ou não permitida para este usuário.", 422);
    }

    return category;
  }

  private async validateCategoryAndType(userId: string, categoryId: string, type: string): Promise<void> {
    const category = await this.getUsableCategory(userId, categoryId);

    if (category.type !== type) {
      throw new AppError("O tipo da transação deve ser igual ao tipo da categoria.", 422);
    }
  }

  async create(userId: string, input: CreateTransactionInput): Promise<Transaction> {
    await this.validateCategoryAndType(userId, input.categoryId, input.type);
    return prisma.transaction.create({ data: { ...input, userId } });
  }

  async list(userId: string, input: TransactionListInput): Promise<PaginatedTransactions> {
    const where: Prisma.TransactionWhereInput = { userId };

    if (input.categoryId) where.categoryId = input.categoryId;
    if (input.paymentMethod) where.paymentMethod = input.paymentMethod;

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

    const [data, total] = await prisma.$transaction([
      prisma.transaction.findMany({
        where,
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
      prisma.transaction.count({ where }),
    ]);

    return { data, meta: { page: input.page, limit: input.limit, total, totalPages: Math.ceil(total / input.limit) } };
  }

  async update(userId: string, transactionId: string, input: UpdateTransactionInput): Promise<Transaction> {
    const transaction = await prisma.transaction.findFirst({ where: { id: transactionId, userId } });

    if (!transaction) {
      throw new AppError("Transação não encontrada.", 404);
    }

    const categoryId = input.categoryId ?? transaction.categoryId;
    const type = input.type ?? transaction.type;
    if (input.categoryId || input.type) await this.validateCategoryAndType(userId, categoryId, type);

    return prisma.transaction.update({ where: { id: transaction.id }, data: input });
  }

  async delete(userId: string, transactionId: string): Promise<void> {
    const transaction = await prisma.transaction.findFirst({ where: { id: transactionId, userId } });

    if (!transaction) {
      throw new AppError("Transação não encontrada.", 404);
    }

    await prisma.transaction.delete({ where: { id: transaction.id } });
  }
}
