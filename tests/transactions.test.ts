import { beforeEach, describe, expect, it } from "vitest";
import { calendarDay } from "../src/lib/dates";
import {
  api,
  createCategory,
  createTransaction,
  createUser,
  resetDatabase,
  type TestUser,
} from "./helpers";

let user: TestUser;
let expense: { id: string };
let income: { id: string };

beforeEach(async () => {
  await resetDatabase();
  user = await createUser();
  expense = await createCategory(user.token);
  income = await createCategory(user.token, { name: "Salário", type: "INCOME" });
});

describe("regras de transação", () => {
  it("exige que o tipo da transação seja igual ao da categoria", async () => {
    const response = await createTransaction(user.token, income.id, { type: "EXPENSE" });
    expect(response.status).toBe(422);
  });

  it.each([0, -5, 0.001, 99_999_999_999_999])("rejeita o valor %d com 400", async (value) => {
    const response = await createTransaction(user.token, expense.id, { value });
    expect(response.status).toBe(400);
  });

  it("aceita o maior valor que cabe no banco", async () => {
    const response = await createTransaction(user.token, expense.id, { value: 9_999_999_999_999 });
    expect(response.status).toBe(201);
  });

  it("não aceita categoria desativada em novos lançamentos", async () => {
    await api(user.token).patch(`/api/categories/${expense.id}/deactivate`);
    const response = await createTransaction(user.token, expense.id);
    expect(response.status).toBe(422);
  });

  it("permite editar transação cuja categoria foi desativada (bug 5)", async () => {
    const created = await createTransaction(user.token, expense.id);
    await api(user.token).patch(`/api/categories/${expense.id}/deactivate`);

    const response = await api(user.token)
      .put(`/api/transactions/${created.body.transaction.id}`)
      .send({ categoryId: expense.id, type: "EXPENSE", description: "Corrigida", value: 80 });

    expect(response.status).toBe(200);
    expect(response.body.transaction.description).toBe("Corrigida");
  });

  it("ainda recusa trocar para uma categoria desativada", async () => {
    const other = await createCategory(user.token, { name: "Outra" });
    const created = await createTransaction(user.token, expense.id);
    await api(user.token).patch(`/api/categories/${other.id}/deactivate`);

    const response = await api(user.token)
      .put(`/api/transactions/${created.body.transaction.id}`)
      .send({ categoryId: other.id });

    expect(response.status).toBe(422);
  });

  it("exclui uma transação", async () => {
    const created = await createTransaction(user.token, expense.id);
    const id = created.body.transaction.id as string;

    expect((await api(user.token).delete(`/api/transactions/${id}`)).status).toBe(204);
    expect((await api(user.token).get("/api/transactions")).body.data).toEqual([]);
  });

  it("filtra por tipo no servidor, com mais de 100 lançamentos (bug 6)", async () => {
    const values = Array.from({ length: 105 }, (_, index) => index + 1);
    await Promise.all(
      values.map((value) =>
        createTransaction(user.token, income.id, { type: "INCOME", value, paymentMethod: "PIX" }),
      ),
    );
    await createTransaction(user.token, expense.id, { value: 50 });

    const response = await api(user.token).get(
      "/api/transactions?type=EXPENSE&month=3&year=2026&limit=100",
    );

    expect(response.body.meta.total).toBe(1);
    expect(response.body.data).toHaveLength(1);
  });
});

describe("dashboard", () => {
  it("agrega no servidor por categoria e origem", async () => {
    await createTransaction(user.token, expense.id, { value: 70 });
    await createTransaction(user.token, expense.id, { value: 30, paymentMethod: "CREDIT_CARD" });
    await createTransaction(user.token, income.id, { type: "INCOME", value: 500 });
    const period = "month=3&year=2026";

    const summary = await api(user.token).get(`/api/dashboard/summary?${period}`);
    const byCategory = await api(user.token).get(`/api/dashboard/by-category?${period}`);
    const byOrigin = await api(user.token).get(`/api/dashboard/by-origin?${period}`);
    const incomeByCategory = await api(user.token).get(
      `/api/dashboard/by-category?${period}&type=INCOME`,
    );

    expect(summary.body).toMatchObject({ totalIncome: 500, totalExpense: 100, netBalance: 400 });
    expect(byCategory.body.categories[0].total).toBe(100);
    expect(byOrigin.body).toEqual({ account: 70, creditCard: 30 });
    expect(incomeByCategory.body.categories[0].category.name).toBe("Salário");
  });

  it("calcula o saldo sem erro de ponto flutuante", async () => {
    await createTransaction(user.token, income.id, { type: "INCOME", value: 0.3 });
    await createTransaction(user.token, expense.id, { value: 0.1 });

    const summary = await api(user.token).get("/api/dashboard/summary?month=3&year=2026");

    expect(summary.body.netBalance).toBe(0.2);
  });

  it("mantém um lançamento do dia 1º dentro do mês certo", async () => {
    await createTransaction(user.token, expense.id, { date: "2026-03-01", value: 10 });
    await createTransaction(user.token, expense.id, { date: "2026-02-28", value: 99 });

    const summary = await api(user.token).get("/api/dashboard/summary?month=3&year=2026");

    expect(summary.body.totalExpense).toBe(10);
  });

  it("recalcula o mês padrão a cada requisição", async () => {
    const summary = await api(user.token).get("/api/dashboard/summary");
    const now = calendarDay(new Date());

    expect(summary.body.period.month).toBe(now.getUTCMonth() + 1);
    expect(summary.body.period.year).toBe(now.getUTCFullYear());
  });
});
