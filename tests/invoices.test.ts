import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
let card: { id: string };

const setToday = (iso: string): void => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${iso}T15:00:00.000Z`));
};

const invoice = async (year: number, month: number, cardId = card.id) =>
  (await api(user.token).get(`/api/cards/${cardId}/invoices/${year}/${month}`)).body.invoice;

const buy = (date: string, extra: Record<string, unknown> = {}, cardId = card.id) =>
  createTransaction(user.token, expense.id, {
    paymentMethod: "CREDIT_CARD",
    cardId,
    date,
    ...extra,
  });

beforeEach(async () => {
  await resetDatabase();
  user = await createUser();
  expense = await createCategory(user.token);
  card = await createCard(user.token, { closingDay: 25, dueDay: 5 });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("faturas", () => {
  it("compras em 24/03 e 25/03 caem em faturas diferentes (abril e maio)", async () => {
    await buy("2026-03-24", { description: "Antes" });
    await buy("2026-03-25", { description: "No fechamento" });

    const april = await invoice(2026, 4);
    const may = await invoice(2026, 5);

    expect(april.transactions.map((item: { description: string }) => item.description)).toEqual([
      "Antes",
    ]);
    expect(may.transactions.map((item: { description: string }) => item.description)).toEqual([
      "No fechamento",
    ]);
    expect(april).toMatchObject({
      start: "2026-02-25",
      end: "2026-03-24",
      closingDate: "2026-03-25",
      dueDate: "2026-04-05",
      transactionsCount: 1,
      total: 100,
    });
  });

  it("as parcelas de uma compra em 3x caem em três faturas seguidas", async () => {
    await buy("2026-03-10", {
      mode: "INSTALLMENTS",
      installments: { count: 3, valueMode: "TOTAL" },
    });

    const counts = [
      (await invoice(2026, 4)).transactionsCount,
      (await invoice(2026, 5)).transactionsCount,
      (await invoice(2026, 6)).transactionsCount,
      (await invoice(2026, 7)).transactionsCount,
    ];

    expect(counts).toEqual([1, 1, 1, 0]);
  });

  it("o total soma só os lançamentos do cartão", async () => {
    const other = await createCard(user.token, { name: "Outro" });
    await buy("2026-03-10", { value: 40.5 });
    await buy("2026-03-12", { value: 10 });
    await buy("2026-03-11", { value: 999 }, other.id);
    await createTransaction(user.token, expense.id, { date: "2026-03-11", value: 500 });

    const april = await invoice(2026, 4);

    expect(april.total).toBe(50.5);
    expect(april.transactionsCount).toBe(2);
  });

  it("mudar o closingDay muda a fatura do lançamento, sem migrar dados", async () => {
    await buy("2026-03-20");

    expect((await invoice(2026, 4)).transactionsCount).toBe(1);

    await api(user.token).put(`/api/cards/${card.id}`).send({ closingDay: 15 });

    expect((await invoice(2026, 4)).transactionsCount).toBe(0);
    expect((await invoice(2026, 5)).transactionsCount).toBe(1);
  });

  it("overview mostra a fatura atual e a próxima e ignora cartões desativados", async () => {
    setToday("2026-03-10");
    const off = await createCard(user.token, { name: "Velho" });
    await buy("2026-03-10", { value: 30 });
    await buy("2026-04-10", { value: 70 });
    await api(user.token).patch(`/api/cards/${off.id}/deactivate`);

    const response = await api(user.token).get("/api/cards/overview");

    expect(response.status).toBe(200);
    expect(response.body.cards).toHaveLength(1);
    const [entry] = response.body.cards;
    expect(entry.card).toMatchObject({ id: card.id, isDefault: true, closingDay: 25 });
    expect(entry.card.datesConfirmedAt).toEqual(expect.any(String));
    expect(entry.current).toMatchObject({
      ref: { year: 2026, month: 4 },
      total: 30,
      status: "OPEN",
    });
    expect(entry.next).toMatchObject({
      ref: { year: 2026, month: 5 },
      total: 70,
      status: "FUTURE",
    });
  });

  it("current devolve a fatura em que cairia uma compra de hoje", async () => {
    setToday("2026-03-26");

    const response = await api(user.token).get(`/api/cards/${card.id}/invoices/current`);

    expect(response.body.invoice.ref).toEqual({ year: 2026, month: 5 });
    expect(response.body.invoice.status).toBe("OPEN");
  });

  it("status: fechada, aberta e futura conforme hoje", async () => {
    setToday("2026-03-10");

    expect((await invoice(2026, 3)).status).toBe("CLOSED");
    expect((await invoice(2026, 4)).status).toBe("OPEN");
    expect((await invoice(2026, 5)).status).toBe("FUTURE");
  });

  it("valida ano e mês e aceita cartão desativado", async () => {
    await createCard(user.token, { name: "Outro" });
    await buy("2026-03-10");
    await api(user.token).patch(`/api/cards/${card.id}/deactivate`);

    const invalidMonth = await api(user.token).get(`/api/cards/${card.id}/invoices/2026/13`);
    const invalidYear = await api(user.token).get(`/api/cards/${card.id}/invoices/1999/1`);

    expect(invalidMonth.status).toBe(400);
    expect(invalidYear.status).toBe(400);
    expect((await invoice(2026, 4)).transactionsCount).toBe(1);
  });
});
