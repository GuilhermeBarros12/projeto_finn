import { beforeEach, describe, expect, it } from "vitest";
import { addMonthsKeepingDay } from "../src/lib/billing-calendar";
import { calendarDay } from "../src/lib/dates";
import {
  api,
  createCard,
  createCategory,
  createTransaction,
  createUser,
  resetDatabase,
  type TestUser,
} from "./helpers";

let user: TestUser;
let expense: { id: string };

const iso = (date: Date): string => date.toISOString().slice(0, 10);
const monthsFromToday = (months: number): string =>
  iso(addMonthsKeepingDay(calendarDay(new Date()), months));

beforeEach(async () => {
  await resetDatabase();
  user = await createUser();
  expense = await createCategory(user.token);
  await createCard(user.token);
});

const installments = (count: number) => ({
  paymentMethod: "CREDIT_CARD",
  value: 500,
  mode: "INSTALLMENTS",
  installments: { count, valueMode: "TOTAL" },
});

describe("escopo em grupo", () => {
  it("FOLLOWING na parcela 3 de 5 apaga 3, 4 e 5 e mantém 1 e 2", async () => {
    const created = await createTransaction(user.token, expense.id, installments(5));
    const parcelas = created.body.transactions;

    const response = await api(user.token).delete(
      `/api/transactions/${parcelas[2].id}?scope=FOLLOWING`,
    );
    const rest = await api(user.token).get("/api/transactions");

    expect(response.status).toBe(204);
    expect(
      rest.body.data.map((item: { installmentNumber: number }) => item.installmentNumber).sort(),
    ).toEqual([1, 2]);
  });

  it("FOLLOWING edita a descrição só de 3 a 5", async () => {
    const created = await createTransaction(user.token, expense.id, installments(5));
    const parcelas = created.body.transactions;

    const response = await api(user.token)
      .put(`/api/transactions/${parcelas[2].id}?scope=FOLLOWING`)
      .send({ description: "Nova" });
    const list = await api(user.token).get("/api/transactions?limit=100");
    const names = Object.fromEntries(
      list.body.data.map((item: { installmentNumber: number; description: string }) => [
        item.installmentNumber,
        item.description,
      ]),
    );

    expect(response.status).toBe(200);
    expect(response.body.updatedCount).toBe(3);
    expect(names).toEqual({ 1: "Compra", 2: "Compra", 3: "Nova", 4: "Nova", 5: "Nova" });
  });

  it("scope=ONE muda só uma parcela, inclusive a data", async () => {
    const created = await createTransaction(user.token, expense.id, installments(3));
    const parcelas = created.body.transactions;

    const response = await api(user.token)
      .put(`/api/transactions/${parcelas[1].id}`)
      .send({ date: "2026-04-20", description: "Só esta" });
    const list = await api(user.token).get("/api/transactions?limit=100");

    expect(response.body.updatedCount).toBe(1);
    expect(response.body.transaction.date.slice(0, 10)).toBe("2026-04-20");
    expect(
      list.body.data.filter((item: { description: string }) => item.description === "Só esta"),
    ).toHaveLength(1);
  });

  it("recusa data com FOLLOWING (400) e parcela virando PIX (422)", async () => {
    const created = await createTransaction(user.token, expense.id, installments(3));
    const id = created.body.transactions[1].id;

    const data = await api(user.token)
      .put(`/api/transactions/${id}?scope=FOLLOWING`)
      .send({ date: "2026-05-01" });
    const pix = await api(user.token).put(`/api/transactions/${id}`).send({ paymentMethod: "PIX" });

    expect(data.status).toBe(400);
    expect(pix.status).toBe(422);
  });

  it("apagar todos os lançamentos de uma recorrência apaga a recorrência", async () => {
    const created = await createTransaction(user.token, expense.id, { mode: "RECURRING" });
    const first = created.body.transactions[0];

    await api(user.token).delete(`/api/transactions/${first.id}?scope=FOLLOWING`);
    const ending = await api(user.token).get("/api/recurrences/ending");
    const renew = await api(user.token).post(`/api/recurrences/${first.recurrenceId}/renew`);

    expect(ending.body.recurrences).toEqual([]);
    expect(renew.status).toBe(404);
  });

  it("trocar para crédito usa o cartão padrão e sair do crédito zera o cartão", async () => {
    const created = await createTransaction(user.token, expense.id);
    const id = created.body.transaction.id;

    const credit = await api(user.token)
      .put(`/api/transactions/${id}`)
      .send({ paymentMethod: "CREDIT_CARD" });
    const pix = await api(user.token).put(`/api/transactions/${id}`).send({ paymentMethod: "PIX" });

    expect(credit.body.transaction.card.name).toBe("Cartão");
    expect(pix.body.transaction.cardId).toBeNull();
  });
});

describe("recorrências", () => {
  const recurring = (start: string, extra: Record<string, unknown> = {}) => ({
    mode: "RECURRING",
    date: start,
    description: "Assinatura",
    ...extra,
  });

  it("lista a que acaba em 1 mês e ignora a com data final e a que acaba em 6 meses", async () => {
    const acabando = await createTransaction(
      user.token,
      expense.id,
      recurring(monthsFromToday(-10)),
    );
    await createTransaction(
      user.token,
      expense.id,
      recurring(monthsFromToday(-10), {
        recurrence: { endDate: monthsFromToday(5) },
        description: "Com fim",
      }),
    );
    await createTransaction(
      user.token,
      expense.id,
      recurring(monthsFromToday(-5), { description: "Longe" }),
    );

    const response = await api(user.token).get("/api/recurrences/ending");

    expect(response.body.recurrences).toHaveLength(1);
    expect(response.body.recurrences[0]).toMatchObject({
      id: acabando.body.transaction.recurrenceId,
      description: "Assinatura",
      value: 100,
      type: "EXPENSE",
      cardName: null,
    });
  });

  it("renew cria 12 lançamentos mantendo o dia âncora e finish tira da lista", async () => {
    const created = await createTransaction(
      user.token,
      expense.id,
      recurring("2026-01-31", { paymentMethod: "CREDIT_CARD" }),
    );
    const recurrenceId = created.body.transaction.recurrenceId;

    const renew = await api(user.token).post(`/api/recurrences/${recurrenceId}/renew`);

    expect(renew.status).toBe(201);
    expect(renew.body.transactions).toHaveLength(12);
    expect(renew.body.transactions[0].date.slice(0, 10)).toBe("2027-01-31");
    expect(renew.body.transactions[3].date.slice(0, 10)).toBe("2027-04-30");
    expect(renew.body.transactions[4].date.slice(0, 10)).toBe("2027-05-31");
    expect(renew.body.transactions[0].card.name).toBe("Cartão");

    const finish = await api(user.token).patch(`/api/recurrences/${recurrenceId}/finish`);
    expect(finish.status).toBe(200);
    expect(finish.body.recurrence.endDate.slice(0, 10)).toBe("2027-12-31");
  });

  it("finish tira a recorrência do aviso", async () => {
    const created = await createTransaction(
      user.token,
      expense.id,
      recurring(monthsFromToday(-10)),
    );
    const recurrenceId = created.body.transaction.recurrenceId;

    await api(user.token).patch(`/api/recurrences/${recurrenceId}/finish`);
    const response = await api(user.token).get("/api/recurrences/ending");

    expect(response.body.recurrences).toEqual([]);
  });

  it("renew recusa cartão desativado", async () => {
    const outro = await createCard(user.token, { name: "Outro" });
    const created = await createTransaction(
      user.token,
      expense.id,
      recurring("2026-01-10", { paymentMethod: "CREDIT_CARD", cardId: outro.id }),
    );
    await api(user.token).patch(`/api/cards/${outro.id}/deactivate`);

    const renew = await api(user.token).post(
      `/api/recurrences/${created.body.transaction.recurrenceId}/renew`,
    );

    expect(renew.status).toBe(422);
  });

  it("renew recusa categoria desativada (422)", async () => {
    const outra = await createCategory(user.token, { name: "Temporária" });
    const created = await createTransaction(user.token, outra.id, recurring("2026-01-10"));
    await api(user.token).patch(`/api/categories/${outra.id}/deactivate`);

    const renew = await api(user.token).post(
      `/api/recurrences/${created.body.transaction.recurrenceId}/renew`,
    );

    expect(renew.status).toBe(422);
    expect(renew.body.message).toBe(
      "A categoria desta recorrência foi desativada. Escolha outra antes de renovar.",
    );
  });

  it("FOLLOWING sem categoryId recusa mudar o tipo quando há outra categoria no grupo", async () => {
    const outra = await createCategory(user.token, { name: "Outra despesa" });
    const created = await createTransaction(user.token, expense.id, recurring("2026-01-10"));
    const ocorrencias = created.body.transactions;
    await api(user.token)
      .put(`/api/transactions/${ocorrencias[2].id}`)
      .send({ categoryId: outra.id });

    const response = await api(user.token)
      .put(`/api/transactions/${ocorrencias[0].id}?scope=FOLLOWING`)
      .send({ type: "INCOME" });

    expect(response.status).toBe(422);
  });
});
