import type { Card } from "../../generated/prisma/client";
import { AppError } from "../lib/app-error";
import { prisma } from "../lib/prisma";
import type { CreateCardInput, UpdateCardInput } from "../schemas/card.schema";

export interface DeactivateCardResult {
  card: Card;
  transactionsCount: number;
}

const NOT_FOUND = "Cartão não encontrado.";

export class CardService {
  async list(userId: string, includeInactive = false): Promise<Card[]> {
    return prisma.card.findMany({
      where: { userId, ...(includeInactive ? {} : { status: true }) },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }, { id: "asc" }],
    });
  }

  async create(userId: string, input: CreateCardInput): Promise<Card> {
    return prisma.$transaction(async (tx) => {
      const activeCards = await tx.card.count({ where: { userId, status: true } });
      const isDefault = activeCards === 0 || input.isDefault === true;

      // Desmarca primeiro por causa do índice único parcial de um padrão por pessoa.
      if (isDefault) {
        await tx.card.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.card.create({
        data: {
          userId,
          name: input.name,
          closingDay: input.closingDay,
          dueDay: input.dueDay,
          isDefault,
          datesConfirmedAt: new Date(),
        },
      });
    });
  }

  async update(userId: string, cardId: string, input: UpdateCardInput): Promise<Card> {
    const card = await prisma.card.findFirst({ where: { id: cardId, userId } });
    if (!card) throw new AppError(NOT_FOUND, 404);

    const closingDay = input.closingDay ?? card.closingDay;
    const dueDay = input.dueDay ?? card.dueDay;

    if (closingDay === dueDay) {
      throw new AppError("O dia de fechamento e o de vencimento precisam ser diferentes.", 422);
    }

    const changedDays = input.closingDay !== undefined || input.dueDay !== undefined;

    return prisma.card.update({
      where: { id: card.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        closingDay,
        dueDay,
        ...(changedDays ? { datesConfirmedAt: new Date() } : {}),
      },
    });
  }

  async setDefault(userId: string, cardId: string): Promise<Card> {
    const card = await prisma.card.findFirst({ where: { id: cardId, userId } });
    if (!card) throw new AppError(NOT_FOUND, 404);
    if (!card.status) throw new AppError("Ative o cartão antes de torná-lo padrão.", 422);

    return prisma.$transaction(async (tx) => {
      await tx.card.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
      return tx.card.update({ where: { id: card.id }, data: { isDefault: true } });
    });
  }

  async deactivate(userId: string, cardId: string): Promise<DeactivateCardResult> {
    const card = await prisma.card.findFirst({
      where: { id: cardId, userId },
      include: { _count: { select: { transactions: true } } },
    });
    if (!card) throw new AppError(NOT_FOUND, 404);
    if (!card.status) throw new AppError("O cartão já está desativado.", 409);

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.card.update({
        where: { id: card.id },
        data: { status: false, isDefault: false },
      });

      if (card.isDefault) {
        const next = await tx.card.findFirst({
          where: { userId, status: true },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        });
        if (next) await tx.card.update({ where: { id: next.id }, data: { isDefault: true } });
      }

      return result;
    });

    return { card: updated, transactionsCount: card._count.transactions };
  }

  /** Cartão ativo e da pessoa; qualquer outro caso é 422. */
  async getUsableCard(userId: string, cardId: string): Promise<Card> {
    const card = await prisma.card.findFirst({ where: { id: cardId, userId, status: true } });
    if (!card) {
      throw new AppError("Cartão não encontrado, inativo ou não permitido para este usuário.", 422);
    }
    return card;
  }

  async getDefaultCard(userId: string): Promise<Card | null> {
    return prisma.card.findFirst({ where: { userId, isDefault: true, status: true } });
  }
}
