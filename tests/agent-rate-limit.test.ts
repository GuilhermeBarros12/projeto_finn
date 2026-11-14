import { beforeEach, describe, expect, it, vi } from "vitest";
import { callModel } from "../src/lib/agent-model";
import { question, textResponse } from "./fake-model";
import { api, createUser, resetDatabase } from "./helpers";

vi.hoisted(() => {
  process.env.AGENT_RATE_LIMIT_MAX = "2";
});

vi.mock("../src/lib/agent-model", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/agent-model")>()),
  callModel: vi.fn(),
}));

beforeEach(async () => {
  vi.mocked(callModel).mockReset();
  vi.mocked(callModel).mockResolvedValue(textResponse("Ok."));
  await resetDatabase();
});

describe("limite de perguntas ao assistente", () => {
  it("bloqueia por pessoa, sem afetar as outras", async () => {
    const first = await createUser();
    const second = await createUser();
    const ask = (token: string) => api(token).post("/api/agent/chat").send(question);

    expect((await ask(first.token)).status).toBe(200);
    expect((await ask(first.token)).status).toBe(200);
    expect((await ask(first.token)).status).toBe(429);
    expect((await ask(second.token)).status).toBe(200);
    expect(callModel).toHaveBeenCalledTimes(3);
  });
});
