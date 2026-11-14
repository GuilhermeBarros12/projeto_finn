import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { calendarDay } from "../src/lib/dates";
import { prisma } from "../src/lib/prisma";
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
const today = calendarDay(new Date()).toISOString().slice(0, 10);

const savingsGoal = {
  title: "Reserva",
  type: "SAVINGS",
  targetValue: 1000,
  dueDate: "2099-12-31",
  categoryId: null,
};

beforeEach(async () => {
  await resetDatabase();
  user = await createUser();
  expense = await createCategory(user.token);
  income = await createCategory(user.token, { name: "Salário", type: "INCOME" });
});

describe("metas no fuso do usuário", () => {
  // 23h58 de 5/11 em Brasília: no relógio UTC já é 6/11.
  const eveningInBrazil = new Date("2026-11-06T02:58:00.000Z");

  afterEach(() => {
    vi.useRealTimers();
  });

  it("converte o instante para o dia do calendário local", () => {
    expect(calendarDay(eveningInBrazil).toISOString()).toBe("2026-11-05T00:00:00.000Z");
  });

  it("conta o lançamento do mesmo dia em meta criada à noite", async () => {
    vi.useFakeTimers({ now: eveningInBrazil, toFake: ["Date"] });
    await createTransaction(user.token, income.id, {
      type: "INCOME",
      value: 400,
      date: "2026-11-05",
    });
    await api(user.token).post("/api/goals").send(savingsGoal);

    const list = await api(user.token).get("/api/goals");

    expect(list.body.data[0]).toMatchObject({ currentValue: 400, progress: 40 });
  });

  it("não expira à noite a meta que vence no próprio dia", async () => {
    vi.useFakeTimers({ now: eveningInBrazil, toFake: ["Date"] });
    await api(user.token)
      .post("/api/goals")
      .send({ ...savingsGoal, dueDate: "2026-11-05" });

    const list = await api(user.token).get("/api/goals");

    expect(list.body.data[0].status).toBe("IN_PROGRESS");
  });
});

describe("metas", () => {
  it("meta de economia não aceita categoria", async () => {
    const response = await api(user.token)
      .post("/api/goals")
      .send({ ...savingsGoal, categoryId: expense.id });

    expect(response.status).toBe(400);
  });

  it("limite de gasto exige categoria de despesa", async () => {
    const limit = {
      title: "Limite",
      type: "SPENDING_LIMIT",
      targetValue: 100,
      dueDate: "2099-12-31",
    };

    const withoutCategory = await api(user.token)
      .post("/api/goals")
      .send({ ...limit, categoryId: null });
    const withIncome = await api(user.token)
      .post("/api/goals")
      .send({ ...limit, categoryId: income.id });

    expect(withoutCategory.status).toBe(400);
    expect(withIncome.status).toBe(422);
  });

  it("calcula o progresso da economia como receitas menos despesas", async () => {
    await api(user.token).post("/api/goals").send(savingsGoal);
    await createTransaction(user.token, income.id, { type: "INCOME", value: 500, date: today });
    await createTransaction(user.token, expense.id, { value: 250, date: today });

    const list = await api(user.token).get("/api/goals");

    expect(list.body.data[0]).toMatchObject({ currentValue: 250, progress: 25 });
  });

  it("ignora lançamentos anteriores à criação da meta", async () => {
    await createTransaction(user.token, income.id, {
      type: "INCOME",
      value: 900,
      date: "2020-01-01",
    });
    await api(user.token).post("/api/goals").send(savingsGoal);

    const list = await api(user.token).get("/api/goals");

    expect(list.body.data[0].currentValue).toBe(0);
  });

  it("calcula o limite de gasto só com a categoria da meta", async () => {
    const other = await createCategory(user.token, { name: "Lazer" });
    await api(user.token).post("/api/goals").send({
      title: "Mercado",
      type: "SPENDING_LIMIT",
      targetValue: 200,
      dueDate: "2099-12-31",
      categoryId: expense.id,
    });
    await createTransaction(user.token, expense.id, { value: 300, date: today });
    await createTransaction(user.token, other.id, { value: 999, date: today });

    const list = await api(user.token).get("/api/goals");

    expect(list.body.data[0]).toMatchObject({ currentValue: 300, progress: 150 });
  });

  it("marca como expirada a meta vencida e em andamento", async () => {
    await api(user.token)
      .post("/api/goals")
      .send({ ...savingsGoal, dueDate: "2020-01-01" });

    const list = await api(user.token).get("/api/goals");
    const expired = await api(user.token).get("/api/goals?status=EXPIRED");

    expect(list.body.data[0].status).toBe("EXPIRED");
    expect(expired.body.meta.total).toBe(1);
  });

  it("não expira meta que vence hoje nem meta já concluída", async () => {
    await api(user.token)
      .post("/api/goals")
      .send({ ...savingsGoal, title: "Hoje", dueDate: today });
    await api(user.token)
      .post("/api/goals")
      .send({ ...savingsGoal, title: "Pronta", dueDate: "2020-01-01", status: "COMPLETED" });

    const list = await api(user.token).get("/api/goals");
    const statusByTitle = Object.fromEntries(
      list.body.data.map((goal: { title: string; status: string }) => [goal.title, goal.status]),
    );

    expect(statusByTitle).toEqual({ Hoje: "IN_PROGRESS", Pronta: "COMPLETED" });
  });

  it("edita e exclui uma meta", async () => {
    const created = await api(user.token).post("/api/goals").send(savingsGoal);
    const id = created.body.goal.id as string;

    const edit = await api(user.token)
      .put(`/api/goals/${id}`)
      .send({ ...savingsGoal, title: "Nova", status: "COMPLETED" });
    const remove = await api(user.token).delete(`/api/goals/${id}`);

    expect(edit.body.goal).toMatchObject({ title: "Nova", status: "COMPLETED" });
    expect(remove.status).toBe(204);
    expect(await prisma.goal.count()).toBe(0);
  });
});

describe("regressões da auditoria de metas", () => {
  const daysFromToday = (days: number) =>
    new Date(calendarDay(new Date()).getTime() + days * 86_400_000).toISOString().slice(0, 10);

  it("não conta receita futura como dinheiro guardado (GOAL-01)", async () => {
    await api(user.token).post("/api/goals").send(savingsGoal);
    await createTransaction(user.token, income.id, { type: "INCOME", value: 100, date: today });
    await createTransaction(user.token, income.id, {
      type: "INCOME",
      value: 900,
      date: daysFromToday(1),
    });

    const list = await api(user.token).get("/api/goals");

    expect(list.body.data[0]).toMatchObject({ currentValue: 100, progress: 10 });
  });

  it("não conta despesa futura no limite de gasto (GOAL-01)", async () => {
    await api(user.token).post("/api/goals").send({
      title: "Mercado",
      type: "SPENDING_LIMIT",
      targetValue: 200,
      dueDate: "2099-12-31",
      categoryId: expense.id,
    });
    await createTransaction(user.token, expense.id, { value: 20, date: today });
    await createTransaction(user.token, expense.id, { value: 500, date: daysFromToday(5) });

    const list = await api(user.token).get("/api/goals");

    expect(list.body.data[0]).toMatchObject({ currentValue: 20, progress: 10 });
  });

  it("não conta lançamento depois do prazo (GOAL-01)", async () => {
    await api(user.token)
      .post("/api/goals")
      .send({ ...savingsGoal, dueDate: today });
    await createTransaction(user.token, income.id, {
      type: "INCOME",
      value: 900,
      date: daysFromToday(1),
    });

    const list = await api(user.token).get("/api/goals");

    expect(list.body.data[0].currentValue).toBe(0);
  });

  describe("com categoria desativada (GOAL-02)", () => {
    const limit = (categoryId: string) => ({
      title: "Limite",
      type: "SPENDING_LIMIT",
      targetValue: 100,
      dueDate: "2099-12-31",
      categoryId,
    });

    const createThenDeactivate = async () => {
      const goal = await api(user.token).post("/api/goals").send(limit(expense.id));
      await api(user.token).patch(`/api/categories/${expense.id}/deactivate`);
      return goal.body.goal.id as string;
    };

    it("permite editar outros campos e devolve o nome da categoria", async () => {
      const id = await createThenDeactivate();

      const edit = await api(user.token)
        .put(`/api/goals/${id}`)
        .send({ ...limit(expense.id), title: "Novo título", status: "IN_PROGRESS" });
      const list = await api(user.token).get("/api/goals");

      expect(edit.status).toBe(200);
      expect(list.body.data[0].category).toEqual({
        id: expense.id,
        name: "Mercado",
        status: false,
      });
    });

    it("permite trocar para uma categoria ativa", async () => {
      const id = await createThenDeactivate();
      const active = await createCategory(user.token, { name: "Lazer" });

      const edit = await api(user.token)
        .put(`/api/goals/${id}`)
        .send({ ...limit(active.id), status: "IN_PROGRESS" });

      expect(edit.status).toBe(200);
    });

    it("ainda recusa criar meta nova com ela", async () => {
      await createThenDeactivate();

      const response = await api(user.token).post("/api/goals").send(limit(expense.id));

      expect(response.status).toBe(422);
    });

    it("ainda recusa trocar para outra categoria desativada", async () => {
      const other = await createCategory(user.token, { name: "Lazer" });
      const goal = await api(user.token).post("/api/goals").send(limit(other.id));
      await api(user.token).patch(`/api/categories/${expense.id}/deactivate`);

      const edit = await api(user.token)
        .put(`/api/goals/${goal.body.goal.id}`)
        .send({ ...limit(expense.id), status: "IN_PROGRESS" });

      expect(edit.status).toBe(422);
    });
  });

  it.each([99.999, "12,50", null])("recusa targetValue %j", async (targetValue) => {
    const response = await api(user.token)
      .post("/api/goals")
      .send({ ...savingsGoal, targetValue });

    expect(response.status).toBe(400);
  });

  it.each([null, 0, "2026-02-31", "2026-03-31T23:30:00-03:00"])(
    "recusa dueDate %j",
    async (dueDate) => {
      const response = await api(user.token)
        .post("/api/goals")
        .send({ ...savingsGoal, dueDate });

      expect(response.status).toBe(400);
    },
  );
});

describe("metas em quantidade (GOAL-03 e GOAL-04)", () => {
  it("calcula todas as metas da página em uma única consulta", async () => {
    const other = await createCategory(user.token, { name: "Lazer" });
    for (let index = 0; index < 12; index += 1) {
      await api(user.token)
        .post("/api/goals")
        .send(
          index % 2 === 0
            ? { ...savingsGoal, title: `Economia ${index}` }
            : {
                title: `Limite ${index}`,
                type: "SPENDING_LIMIT",
                targetValue: 100,
                dueDate: "2099-12-31",
                categoryId: index % 4 === 1 ? expense.id : other.id,
              },
        );
    }
    await createTransaction(user.token, income.id, { type: "INCOME", value: 300, date: today });
    await createTransaction(user.token, expense.id, { value: 50, date: today });
    await createTransaction(user.token, other.id, { value: 20, date: today });

    const raw = vi.spyOn(prisma, "$queryRaw");
    const aggregate = vi.spyOn(prisma.transaction, "aggregate");
    const groupBy = vi.spyOn(prisma.transaction, "groupBy");
    const list = await api(user.token).get("/api/goals?limit=100");
    const calls = {
      raw: raw.mock.calls.length,
      porMeta: aggregate.mock.calls.length + groupBy.mock.calls.length,
    };
    raw.mockRestore();
    aggregate.mockRestore();
    groupBy.mockRestore();

    const valueOf = (title: string) =>
      list.body.data.find((goal: { title: string }) => goal.title === title).currentValue;
    expect(calls).toEqual({ raw: 1, porMeta: 0 });
    expect(valueOf("Economia 0")).toBe(230);
    expect(valueOf("Limite 1")).toBe(50);
    expect(valueOf("Limite 3")).toBe(20);
  });

  it("pagina sem repetir nem perder metas com o mesmo prazo", async () => {
    await prisma.goal.createMany({
      data: Array.from({ length: 101 }, (_, index) => ({
        userId: user.id,
        title: `Meta ${index}`,
        type: "SAVINGS" as const,
        targetValue: 10,
        dueDate: new Date("2099-12-31T00:00:00.000Z"),
      })),
    });

    const first = await api(user.token).get("/api/goals?limit=100&page=1");
    const second = await api(user.token).get("/api/goals?limit=100&page=2");
    const ids = [...first.body.data, ...second.body.data].map((goal: { id: string }) => goal.id);

    expect(first.body.meta.total).toBe(101);
    expect(second.body.data).toHaveLength(1);
    expect(new Set(ids).size).toBe(101);
  });
});
