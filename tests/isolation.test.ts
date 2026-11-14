import { beforeEach, describe, expect, it, vi } from "vitest";
import { callModel } from "../src/lib/agent-model";
import { agentTools } from "../src/services/agent-tools";
import { textResponse, toolResponse } from "./fake-model";
import {
  api,
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
