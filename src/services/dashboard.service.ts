import { type CategoryType } from "../../generated/prisma/client";
import { prisma } from "../lib/prisma";
import type { DashboardPeriodInput } from "../schemas/dashboard.schema";

export interface DashboardSummary {
  period: DashboardPeriodInput;
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
}

export interface CategoryExpense {
  category: { id: string; name: string; icon: string; color: string };
  total: number;
  transactionsCount: number;
}

export class DashboardService {
  private getDateRange({ month, year }: DashboardPeriodInput): { start: Date; end: Date } {
    return {
      start: new Date(Date.UTC(year, month - 1, 1)),
      end: new Date(Date.UTC(year, month, 1)),
    };
  }

  private getTotalByType(
    groups: Array<{ type: CategoryType; _sum: { value: { toNumber(): number } | null } }>,
    type: CategoryType,
  ): number {
    return groups.find((group) => group.type === type)?._sum.value?.toNumber() ?? 0;
  }

  async summary(userId: string, period: DashboardPeriodInput): Promise<DashboardSummary> {
    const { start, end } = this.getDateRange(period);
    const groups = await prisma.transaction.groupBy({
      by: ["type"],
      where: { userId, date: { gte: start, lt: end } },
      _sum: { value: true },
    });

    const totalIncome = this.getTotalByType(groups, "INCOME");
    const totalExpense = this.getTotalByType(groups, "EXPENSE");

    return {
      period,
      totalIncome,
      totalExpense,
      netBalance: totalIncome - totalExpense,
    };
  }

  async expensesByCategory(userId: string, period: DashboardPeriodInput): Promise<CategoryExpense[]> {
    const { start, end } = this.getDateRange(period);
    const groups = await prisma.transaction.groupBy({
      by: ["categoryId"],
      where: { userId, type: "EXPENSE", date: { gte: start, lt: end } },
      _sum: { value: true },
      _count: { _all: true },
      orderBy: { _sum: { value: "desc" } },
    });

    const categories = await prisma.category.findMany({
      where: { id: { in: groups.map((group) => group.categoryId) } },
      select: { id: true, name: true, icon: true, color: true },
    });
    const categoriesById = new Map(categories.map((category) => [category.id, category]));

    return groups.flatMap((group) => {
      const category = categoriesById.get(group.categoryId);
      if (!category) return [];

      return [{ category, total: group._sum.value?.toNumber() ?? 0, transactionsCount: group._count._all }];
    });
  }
}
