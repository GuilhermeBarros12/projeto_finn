import type { Category } from "../../generated/prisma/client";
import { randomBytes } from "node:crypto";
import { AppError } from "../lib/app-error";
import { prisma } from "../lib/prisma";
import type { CreateCategoryInput } from "../schemas/category.schema";

export interface DeactivateCategoryResult {
  category: Category;
  transactionsCount: number;
}

export class CategoryService {
  private async generateCode(userId: string): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = randomBytes(5).toString("hex").toUpperCase();
      const existing = await prisma.category.findFirst({ where: { userId, code }, select: { id: true } });

      if (!existing) return code;
    }

    throw new AppError("Não foi possível gerar um código de categoria único. Tente novamente.", 503);
  }

  async list(userId: string): Promise<Category[]> {
    return prisma.category.findMany({
      where: { status: true, OR: [{ userId: null }, { userId }] },
      orderBy: [{ userId: "asc" }, { name: "asc" }],
    });
  }

  async create(userId: string, input: CreateCategoryInput): Promise<Category> {
    const code = await this.generateCode(userId);
    return prisma.category.create({ data: { ...input, code, userId } });
  }

  async deactivate(userId: string, categoryId: string): Promise<DeactivateCategoryResult> {
    const category = await prisma.category.findFirst({
      where: { id: categoryId, userId },
      include: { _count: { select: { transactions: true } } },
    });

    if (!category) {
      throw new AppError("Categoria não encontrada ou não pertence ao usuário autenticado.", 404);
    }

    if (!category.status) {
      throw new AppError("A categoria já está desativada.", 409);
    }

    const updatedCategory = await prisma.category.update({
      where: { id: category.id },
      data: { status: false },
    });

    return { category: updatedCategory, transactionsCount: category._count.transactions };
  }
}
