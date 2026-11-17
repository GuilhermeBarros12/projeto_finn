import { beforeEach, describe, expect, it, vi } from "vitest";
import { callModel } from "../src/lib/agent-model";
import { agentTools } from "../src/services/agent-tools";
import { textResponse, toolResponse } from "./fake-model";
import {
  api,
  createCard,
  createCategory,
  createTransaction,
  createUser,
  resetDatabase,
  type TestUser,
} from "./helpers";

vi.mock("../src/lib/agent-model", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/agent-model")>()),
  callModel: vi.fn(),
}));

let alice: TestUser;
let bob: TestUser;
let aliceCategory: { id: string };
let aliceTransactionId: string;

beforeEach(async () => {
  await resetDatabase();
  alice = await createUser();
  bob = await createUser();
  aliceCategory = await createCategory(alice.token);
  const transaction = await createTransaction(alice.token, aliceCategory.id, {
    description: "Segredo da Alice",
  });
  aliceTransactionId = transaction.body.transaction.id;
});

describe("isolamento entre usuários", () => {
  it("não lista transações de outra pessoa", async () => {
    const response = await api(bob.token).get("/api/transactions");

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
  });

  it("não deixa editar nem excluir transação de outra pessoa", async () => {
    const edit = await api(bob.token)
      .put(`/api/transactions/${aliceTransactionId}`)
      .send({ description: "invadido" });
    const remove = await api(bob.token).delete(`/api/transactions/${aliceTransactionId}`);
    const original = await api(alice.token).get("/api/transactions");

    expect(edit.status).toBe(404);
    expect(remove.status).toBe(404);
    expect(original.body.data[0].description).toBe("Segredo da Alice");
  });

  it("não deixa usar nem desativar categoria de outra pessoa", async () => {
    const use = await createTransaction(bob.token, aliceCategory.id);
    const deactivate = await api(bob.token).patch(`/api/categories/${aliceCategory.id}/deactivate`);
    const list = await api(bob.token).get("/api/categories");

    expect(use.status).toBe(422);
    expect(deactivate.status).toBe(404);
    expect(list.body.categories).toEqual([]);
  });

  it("não deixa ler, editar, tornar padrão nem desativar cartão de outra pessoa", async () => {
    const card = await createCard(alice.token);

    const list = await api(bob.token).get("/api/cards?includeInactive=true");
    const edit = await api(bob.token).put(`/api/cards/${card.id}`).send({ name: "Invadido" });
    const makeDefault = await api(bob.token).patch(`/api/cards/${card.id}/default`);
    const deactivate = await api(bob.token).patch(`/api/cards/${card.id}/deactivate`);
    const original = await api(alice.token).get("/api/cards");

    expect(list.body.cards).toEqual([]);
    expect(edit.status).toBe(404);
    expect(makeDefault.status).toBe(404);
    expect(deactivate.status).toBe(404);
    expect(original.body.cards[0].name).toBe("Cartão");
    expect(original.body.cards[0].status).toBe(true);
  });

  it("não deixa ver, renovar, encerrar nem editar em grupo recorrência de outra pessoa", async () => {
    await createCard(alice.token);
    const created = await createTransaction(alice.token, aliceCategory.id, {
      mode: "RECURRING",
      date: "2026-01-10",
    });
    const recurrenceId = created.body.transaction.recurrenceId as string;
    const transactionId = created.body.transaction.id as string;

    const ending = await api(bob.token).get("/api/recurrences/ending");
    const renew = await api(bob.token).post(`/api/recurrences/${recurrenceId}/renew`);
    const finish = await api(bob.token).patch(`/api/recurrences/${recurrenceId}/finish`);
    const edit = await api(bob.token)
      .put(`/api/transactions/${transactionId}?scope=FOLLOWING`)
      .send({ description: "invadido" });
    const remove = await api(bob.token).delete(
      `/api/transactions/${transactionId}?scope=FOLLOWING`,
    );
    const original = await api(alice.token).get("/api/transactions?limit=100");

    expect(ending.body.recurrences).toEqual([]);
    expect(renew.status).toBe(404);
    expect(finish.status).toBe(404);
    expect(edit.status).toBe(404);
    expect(remove.status).toBe(404);
    expect(original.body.meta.total).toBe(13);
  });

  it("não deixa ver fatura de cartão de outra pessoa", async () => {
    const card = await createCard(alice.token);
    await createTransaction(alice.token, aliceCategory.id, {
      paymentMethod: "CREDIT_CARD",
      cardId: card.id,
    });

    const current = await api(bob.token).get(`/api/cards/${card.id}/invoices/current`);
    const month = await api(bob.token).get(`/api/cards/${card.id}/invoices/2026/4`);
    const overview = await api(bob.token).get("/api/cards/overview");

    expect(current.status).toBe(404);
    expect(month.status).toBe(404);
    expect(overview.body.cards).toEqual([]);
  });

  it("não deixa o assistente ler fatura de cartão de outra pessoa", async () => {
    const card = await createCard(alice.token, { name: "Cartão secreto" });
    await createTransaction(alice.token, aliceCategory.id, {
      description: "Compra secreta",
      paymentMethod: "CREDIT_CARD",
      cardId: card.id,
    });
    vi.mocked(callModel)
      .mockResolvedValueOnce(
        toolResponse([
          { name: "consultar_fatura", input: { cardId: card.id, month: null, year: null } },
          { name: "listar_cartoes", input: {} },
        ]),
      )
      .mockResolvedValueOnce(textResponse("Ok."));

    await api(bob.token)
      .post("/api/agent/chat")
      .send({ messages: [{ role: "user", content: "Minha fatura?" }] });
    const { messages } = vi.mocked(callModel).mock.calls.at(-1)?.[0] as {
      messages: Array<{ content: unknown }>;
    };
    const results = messages.at(-1)?.content as Array<{ content: string; is_error: boolean }>;

    expect(results[0]?.is_error).toBe(true);
    expect(results[1]?.content).toBe("[]");
    expect(JSON.stringify(results)).not.toContain("Cartão secreto");
    expect(JSON.stringify(results)).not.toContain("Compra secreta");
  });

  it("não mistura valores no dashboard", async () => {
    const period = "month=3&year=2026";
    const summary = await api(bob.token).get(`/api/dashboard/summary?${period}`);
    const byCategory = await api(bob.token).get(`/api/dashboard/by-category?${period}`);
    const byOrigin = await api(bob.token).get(`/api/dashboard/by-origin?${period}`);

    expect(summary.body.totalExpense).toBe(0);
    expect(byCategory.body.categories).toEqual([]);
    expect(byOrigin.body).toEqual({ account: 0, creditCard: 0 });
  });

  it("não vaza dados na exportação", async () => {
    const csv = await api(bob.token).get("/api/exports/transactions?format=csv");
    const json = await api(bob.token).get("/api/exports/transactions?format=json");

    expect(csv.text).not.toContain("Segredo da Alice");
    expect(JSON.parse(json.text).meta.total).toBe(0);
  });

  it("não deixa ler, editar nem excluir meta de outra pessoa", async () => {
    const goal = await api(alice.token).post("/api/goals").send({
      title: "Viagem",
      type: "SAVINGS",
      targetValue: 1000,
      dueDate: "2099-01-01",
      categoryId: null,
    });
    const id = goal.body.goal.id as string;

    const list = await api(bob.token).get("/api/goals");
    const edit = await api(bob.token).put(`/api/goals/${id}`).send({
      title: "Invadida",
      type: "SAVINGS",
      targetValue: 1,
      dueDate: "2099-01-01",
      status: "COMPLETED",
      categoryId: null,
    });
    const remove = await api(bob.token).delete(`/api/goals/${id}`);

    expect(list.body.data).toEqual([]);
    expect(edit.status).toBe(404);
    expect(remove.status).toBe(404);
  });

  it("não aceita meta de limite em categoria de outra pessoa", async () => {
    const response = await api(bob.token).post("/api/goals").send({
      title: "Limite",
      type: "SPENDING_LIMIT",
      targetValue: 100,
      dueDate: "2099-01-01",
      categoryId: aliceCategory.id,
    });

    expect(response.status).toBe(422);
  });

  it("não deixa o assistente ler dados de outra pessoa, mesmo com userId forjado", async () => {
    await api(alice.token).post("/api/goals").send({
      title: "Viagem secreta",
      type: "SAVINGS",
      targetValue: 1000,
      dueDate: "2099-01-01",
      categoryId: null,
    });
    const everyTool = agentTools.map(({ name }) => ({
      name,
      input: {
        month: 3,
        year: 2026,
        type: null,
        categoryId: null,
        page: null,
        status: null,
        userId: alice.id,
      },
    }));
    const model = vi.mocked(callModel);
    const askAs = async (token: string) => {
      model.mockReset();
      model
        .mockResolvedValueOnce(toolResponse(everyTool))
        .mockResolvedValueOnce(textResponse("Ok."));
      const response = await api(token)
        .post("/api/agent/chat")
        .send({ messages: [{ role: "user", content: "Mostre tudo" }] });
      expect(response.status).toBe(200);
      return JSON.stringify(model.mock.calls.at(-1)?.[0].messages);
    };

    const seenByBob = await askAs(bob.token);
    const seenByAlice = await askAs(alice.token);

    expect(seenByAlice).toContain("Segredo da Alice");
    expect(seenByAlice).toContain("Viagem secreta");
    expect(seenByBob).not.toContain("Segredo da Alice");
    expect(seenByBob).not.toContain("Viagem secreta");
    expect(seenByBob).not.toContain(aliceCategory.id);
  });

  it("não lista categorias desativadas de outra pessoa", async () => {
    await api(alice.token).patch(`/api/categories/${aliceCategory.id}/deactivate`);

    const list = await api(bob.token).get("/api/categories?includeInactive=true");

    expect(list.body.categories).toEqual([]);
  });
});
