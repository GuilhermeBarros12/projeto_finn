import { Prisma, type CategoryType, type PaymentMethod } from "../../generated/prisma/client";
import { prisma } from "../lib/prisma";
import type { DashboardPeriodInput } from "../schemas/dashboard.schema";

export interface DashboardSummary {
  period: DashboardPeriodInput;
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
}

export interface CategoryTotal {
  category: { id: string; name: string; icon: string; color: string };
  total: number;
  transactionsCount: number;
}

export interface OriginTotals {
  account: number;
  creditCard: number;
}

const ZERO = new Prisma.Decimal(0);
const CREDIT_CARD: PaymentMethod = "CREDIT_CARD";
const ACCOUNT_METHODS: PaymentMethod[] = ["PIX", "DEBIT_CARD", "CASH", "BANK_TRANSFER", "OTHER"];

export class DashboardService {
  private getDateRange({ month, year }: DashboardPeriodInput): { start: Date; end: Date } {
    return {
      start: new Date(Date.UTC(year, month - 1, 1)),
      end: new Date(Date.UTC(year, month, 1)),
    };
  }

  private getFilters(userId: string, period: DashboardPeriodInput): Prisma.TransactionWhereInput {
    const { start, end } = this.getDateRange(period);
    const where: Prisma.TransactionWhereInput = { userId, date: { gte: start, lt: end } };

    if (period.categoryId) where.categoryId = period.categoryId;
    if (period.origin === "CREDIT_CARD") where.paymentMethod = CREDIT_CARD;
    if (period.origin === "ACCOUNT") where.paymentMethod = { in: ACCOUNT_METHODS };

    return where;
  }

  private getTotalByType(
    groups: Array<{ type: CategoryType; _sum: { value: Prisma.Decimal | null } }>,
    type: CategoryType,
  ): Prisma.Decimal {
    return groups.find((group) => group.type === type)?._sum.value ?? ZERO;
  }

  async summary(userId: string, period: DashboardPeriodInput): Promise<DashboardSummary> {
    const groups = await prisma.transaction.groupBy({
      by: ["type"],
      where: this.getFilters(userId, period),
      _sum: { value: true },
    });

    const totalIncome = this.getTotalByType(groups, "INCOME");
    const totalExpense = this.getTotalByType(groups, "EXPENSE");

    return {
      period,
      totalIncome: totalIncome.toNumber(),
      totalExpense: totalExpense.toNumber(),
      // A subtração é feita em Decimal para não herdar o erro de ponto flutuante.
      netBalance: totalIncome.minus(totalExpense).toNumber(),
    };
  }

  async totalsByCategory(userId: string, period: DashboardPeriodInput): Promise<CategoryTotal[]> {
    const groups = await prisma.transaction.groupBy({
      by: ["categoryId"],
      where: { ...this.getFilters(userId, period), type: period.type },
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

      return [
        {
          category,
          total: group._sum.value?.toNumber() ?? 0,
          transactionsCount: group._count._all,
        },
      ];
    });
  }

  async totalsByOrigin(userId: string, period: DashboardPeriodInput): Promise<OriginTotals> {
    const groups = await prisma.transaction.groupBy({
      by: ["paymentMethod"],
      where: { ...this.getFilters(userId, period), type: period.type },
      _sum: { value: true },
    });

    let account = ZERO;
    let creditCard = ZERO;

    for (const group of groups) {
      const value = group._sum.value ?? ZERO;
      if (group.paymentMethod === CREDIT_CARD) creditCard = creditCard.plus(value);
      else account = account.plus(value);
    }

    return { account: account.toNumber(), creditCard: creditCard.toNumber() };
  }
}
