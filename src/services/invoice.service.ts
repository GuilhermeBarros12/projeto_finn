import type { Card } from "../../generated/prisma/client";
import {
  invoiceForDate,
  invoicePeriod,
  shiftInvoiceRef,
  type InvoicePeriod,
  type InvoiceRef,
} from "../lib/billing-calendar";
import { AppError } from "../lib/app-error";
import { addUtcDays, calendarDay } from "../lib/dates";
import { prisma } from "../lib/prisma";
import { WITH_RELATIONS, type TransactionWithCategory } from "./transaction.service";

export interface InvoiceSummary {
  ref: InvoiceRef;
  start: string;
  end: string;
  closingDate: string;
  dueDate: string;
  status: "CLOSED" | "OPEN" | "FUTURE";
  total: number;
  transactionsCount: number;
}

export interface Invoice extends InvoiceSummary {
  card: { id: string; name: string; closingDay: number; dueDay: number };
  transactions: TransactionWithCategory[];
}

export interface CardOverview {
  card: Pick<Card, "id" | "name" | "closingDay" | "dueDay" | "isDefault" | "datesConfirmedAt">;
  current: InvoiceSummary;
  next: InvoiceSummary;
}

const day = (date: Date): string => date.toISOString().slice(0, 10);

export class InvoiceService {
  private async findCard(userId: string, cardId: string): Promise<Card> {
    const card = await prisma.card.findFirst({ where: { id: cardId, userId } });
    if (!card) throw new AppError("Cartão não encontrado.", 404);
    return card;
  }

  private status(period: InvoicePeriod): InvoiceSummary["status"] {
    const today = calendarDay(new Date());
    if (period.closingDate <= today) return "CLOSED";
    if (period.start > today) return "FUTURE";
    return "OPEN";
  }

  private async summarize(
    userId: string,
    card: Card,
    period: InvoicePeriod,
  ): Promise<InvoiceSummary> {
    const sum = await prisma.transaction.aggregate({
      where: { userId, cardId: card.id, date: { gte: period.start, lt: period.closingDate } },
      _sum: { value: true },
      _count: true,
    });

    return {
      ref: period.ref,
      start: day(period.start),
      end: day(addUtcDays(period.closingDate, -1)),
      closingDate: day(period.closingDate),
      dueDate: day(period.dueDate),
      status: this.status(period),
      total: sum._sum.value?.toNumber() ?? 0,
      transactionsCount: sum._count,
    };
  }

  /** Resumo sem a lista de lançamentos. */
  async invoiceSummary(userId: string, cardId: string, ref: InvoiceRef): Promise<InvoiceSummary> {
    const card = await this.findCard(userId, cardId);
    return this.summarize(userId, card, invoicePeriod(card, ref));
  }

  async invoice(userId: string, cardId: string, ref: InvoiceRef): Promise<Invoice> {
    const card = await this.findCard(userId, cardId);
    const period = invoicePeriod(card, ref);
    const [summary, transactions] = await Promise.all([
      this.summarize(userId, card, period),
      prisma.transaction.findMany({
        where: { userId, cardId: card.id, date: { gte: period.start, lt: period.closingDate } },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }, { id: "asc" }],
        include: WITH_RELATIONS,
      }),
    ]);

    return {
      ...summary,
      card: { id: card.id, name: card.name, closingDay: card.closingDay, dueDay: card.dueDay },
      transactions,
    };
  }

  /** Fatura em que cairia uma compra feita hoje. */
  async current(userId: string, cardId: string): Promise<Invoice> {
    const card = await this.findCard(userId, cardId);
    return this.invoice(userId, cardId, invoiceForDate(card, calendarDay(new Date())).ref);
  }

  async overview(userId: string): Promise<CardOverview[]> {
    const cards = await prisma.card.findMany({
      where: { userId, status: true },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }, { id: "asc" }],
    });
    const today = calendarDay(new Date());

    return Promise.all(
      cards.map(async (card) => {
        const currentRef = invoiceForDate(card, today).ref;
        const [current, next] = await Promise.all([
          this.summarize(userId, card, invoicePeriod(card, currentRef)),
          this.summarize(userId, card, invoicePeriod(card, shiftInvoiceRef(currentRef, 1))),
        ]);

        return {
          card: {
            id: card.id,
            name: card.name,
            closingDay: card.closingDay,
            dueDay: card.dueDay,
            isDefault: card.isDefault,
            datesConfirmedAt: card.datesConfirmedAt,
          },
          current,
          next,
        };
      }),
    );
  }
}
