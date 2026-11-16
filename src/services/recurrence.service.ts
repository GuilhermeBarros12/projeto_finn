import type { Recurrence } from "../../generated/prisma/client";
import { addMonthsKeepingDay } from "../lib/billing-calendar";
import { AppError } from "../lib/app-error";
import { calendarDay } from "../lib/dates";
import { prisma } from "../lib/prisma";
import { CardService } from "./card.service";
import type { TransactionWithCategory } from "./transaction.service";

const RENEW_MONTHS = 12;
const WARNING_MONTHS = 2;
const NOT_FOUND = "Recorrência não encontrada.";
const WITH_RELATIONS = {
  category: { select: { id: true, name: true, icon: true, color: true } },
  card: { select: { id: true, name: true } },
} as const;

export interface EndingRecurrence {
  id: string;
  description: string;
  value: number;
  type: "INCOME" | "EXPENSE";
  lastDate: string;
  cardName: string | null;
}

const monthIndex = (date: Date): number => date.getUTCFullYear() * 12 + date.getUTCMonth();

export class RecurrenceService {
  constructor(private readonly cardService = new CardService()) {}

  /** Recorrências sem data final cujo último lançamento cai nos próximos 2 meses. */
  async ending(userId: string): Promise<EndingRecurrence[]> {
    const today = calendarDay(new Date());
    const limit = addMonthsKeepingDay(today, WARNING_MONTHS);

    const recurrences = await prisma.recurrence.findMany({
      where: { userId, endDate: null },
      include: {
        transactions: {
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
          take: 1,
          include: { card: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return recurrences.flatMap((recurrence): EndingRecurrence[] => {
      const last = recurrence.transactions[0];
      if (!last || last.date < today || last.date > limit) return [];

      return [
        {
          id: recurrence.id,
          description: last.description,
          value: last.value.toNumber(),
          type: last.type,
          lastDate: last.date.toISOString().slice(0, 10),
          cardName: last.card?.name ?? null,
        },
      ];
    });
  }

  private async findOwned(userId: string, recurrenceId: string): Promise<Recurrence> {
    const recurrence = await prisma.recurrence.findFirst({ where: { id: recurrenceId, userId } });
    if (!recurrence) throw new AppError(NOT_FOUND, 404);
    return recurrence;
  }

  /** Copia o último lançamento para os 12 meses seguintes, ancorando no dia do primeiro. */
  async renew(userId: string, recurrenceId: string): Promise<TransactionWithCategory[]> {
    const recurrence = await this.findOwned(userId, recurrenceId);

    const [first, last] = await Promise.all([
      prisma.transaction.findFirst({
        where: { recurrenceId: recurrence.id, userId },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      }),
      prisma.transaction.findFirst({
        where: { recurrenceId: recurrence.id, userId },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      }),
    ]);

    if (!first || !last) throw new AppError(NOT_FOUND, 404);

    if (last.cardId) await this.cardService.getUsableCard(userId, last.cardId);

    const offset = monthIndex(last.date) - monthIndex(first.date);

    return prisma.$transaction(async (tx) => {
      const created: TransactionWithCategory[] = [];
      for (let month = 1; month <= RENEW_MONTHS; month += 1) {
        created.push(
          await tx.transaction.create({
            data: {
              userId,
              categoryId: last.categoryId,
              type: last.type,
              description: last.description,
              value: last.value,
              paymentMethod: last.paymentMethod,
              cardId: last.cardId,
              recurrenceId: recurrence.id,
              date: addMonthsKeepingDay(first.date, offset + month),
            },
            include: WITH_RELATIONS,
          }),
        );
      }
      return created;
    });
  }

  /** Grava a data final no último lançamento, o que tira o aviso. Não apaga nada. */
  async finish(userId: string, recurrenceId: string): Promise<Recurrence> {
    const recurrence = await this.findOwned(userId, recurrenceId);
    const last = await prisma.transaction.findFirst({
      where: { recurrenceId: recurrence.id, userId },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });

    if (!last) throw new AppError(NOT_FOUND, 404);

    return prisma.recurrence.update({ where: { id: recurrence.id }, data: { endDate: last.date } });
  }
}
