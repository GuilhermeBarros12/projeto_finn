import type { Category } from "../../generated/prisma/client";
import { AppError } from "../lib/app-error";
import { prisma } from "../lib/prisma";
import type { CreateCategoryInput } from "../schemas/category.schema";

export interface DeactivateCategoryResult {
  category: Category;
  transactionsCount: number;
}

export class CategoryService {
  async list(userId: string): Promise<Category[]> {
    return prisma.category.findMany({
      where: { status: true, OR: [{ userId: null }, { userId }] },
      orderBy: [{ userId: "asc" }, { name: "asc" }],
    });
  }

  async create(userId: string, input: CreateCategoryInput): Promise<Category> {
    return prisma.category.create({ data: { ...input, userId } });
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
