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

describe("validação de entrada (MONEY-01 e DATE-01)", () => {
  it.each([10.001, 10.005, 0.015, "12,50", "1e3", "abc", null, true])(
    "recusa o valor %j",
    async (value) => {
      const response = await createTransaction(user.token, expense.id, { value });
      expect(response.status).toBe(400);
    },
  );

  it.each([
    [0.01, "0.01"],
    [10.1, "10.1"],
    [45.9, "45.9"],
    ["10.50", "10.5"],
    [9_999_999_999_999.99, "9999999999999.99"],
  ])("guarda o valor %j sem alterá-lo", async (value, stored) => {
    const response = await createTransaction(user.token, expense.id, { value });

    expect(response.status).toBe(201);
    expect(response.body.transaction.value).toBe(stored);
  });

  it.each([null, 0, true, "2026-02-31", "31/03/2026", "2026-03-31T23:30:00-03:00"])(
    "recusa a data %j",
    async (date) => {
      const response = await createTransaction(user.token, expense.id, { date });
      expect(response.status).toBe(400);
    },
  );

  it("aceita 29 de fevereiro só em ano bissexto", async () => {
    const leap = await createTransaction(user.token, expense.id, { date: "2028-02-29" });
    const common = await createTransaction(user.token, expense.id, { date: "2027-02-29" });

    expect(leap.status).toBe(201);
    expect(common.status).toBe(400);
  });

  it("guarda o dia do calendário à meia-noite UTC", async () => {
    const response = await createTransaction(user.token, expense.id, { date: "2026-03-31" });

    expect(response.body.transaction.date).toBe("2026-03-31T00:00:00.000Z");
  });

  it("aplica as mesmas regras ao editar", async () => {
    const created = await createTransaction(user.token, expense.id);
    const url = `/api/transactions/${created.body.transaction.id}`;

    expect((await api(user.token).put(url).send({ value: 1.234 })).status).toBe(400);
    expect((await api(user.token).put(url).send({ date: null })).status).toBe(400);
    expect((await api(user.token).put(url).send({ value: 1.23 })).status).toBe(200);
  });
});

describe("listagem de categorias (UI-04)", () => {
  it("só inclui as desativadas quando pedido", async () => {
    await api(user.token).patch(`/api/categories/${expense.id}/deactivate`);

    const active = await api(user.token).get("/api/categories");
    const all = await api(user.token).get("/api/categories?includeInactive=true");

    expect(active.body.categories.map((category: { id: string }) => category.id)).not.toContain(
      expense.id,
    );
    expect(
      all.body.categories.find((category: { id: string }) => category.id === expense.id),
    ).toMatchObject({ status: false });
  });

  it("recusa valor desconhecido no filtro", async () => {
    const response = await api(user.token).get("/api/categories?includeInactive=sim");
    expect(response.status).toBe(400);
  });
});
