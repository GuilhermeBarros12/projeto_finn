import type { Goal, Prisma } from "../../generated/prisma/client";
import { AppError } from "../lib/app-error";
import { prisma } from "../lib/prisma";
import type { CreateGoalInput, GoalListInput, UpdateGoalInput } from "../schemas/goal.schema";

export class GoalService {
  private async validateCategory(userId: string, input: CreateGoalInput | UpdateGoalInput): Promise<void> {
    if (input.type !== "SPENDING_LIMIT" || !input.categoryId) return;
    const category = await prisma.category.findFirst({ where: { id: input.categoryId, status: true, type: "EXPENSE", OR: [{ userId: null }, { userId }] } });
    if (!category) throw new AppError("A categoria do limite deve ser uma despesa ativa e permitida.", 422);
  }
  async create(userId: string, input: CreateGoalInput): Promise<Goal> { await this.validateCategory(userId, input); return prisma.goal.create({ data: { ...input, userId } }); }
  async list(userId: string, input: GoalListInput): Promise<{ data: Goal[]; meta: { page: number; limit: number; total: number } }> {
    const where: Prisma.GoalWhereInput = { userId, ...(input.status ? { status: input.status } : {}) };
    const [data, total] = await prisma.$transaction([prisma.goal.findMany({ where, orderBy: { dueDate: "asc" }, skip: (input.page - 1) * input.limit, take: input.limit }), prisma.goal.count({ where })]);
    return { data, meta: { page: input.page, limit: input.limit, total } };
  }
  async update(userId: string, id: string, input: UpdateGoalInput): Promise<Goal> {
    const goal = await prisma.goal.findFirst({ where: { id, userId } }); if (!goal) throw new AppError("Meta não encontrada.", 404);
    await this.validateCategory(userId, input); return prisma.goal.update({ where: { id }, data: input });
  }
  async delete(userId: string, id: string): Promise<void> { const result = await prisma.goal.deleteMany({ where: { id, userId } }); if (!result.count) throw new AppError("Meta não encontrada.", 404); }
}
