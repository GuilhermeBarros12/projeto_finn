import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Express } from "express";

let app: Express;

beforeAll(async () => {
  vi.stubEnv("LOGIN_RATE_LIMIT_MAX", "3");
  vi.resetModules();
  ({ app } = await import("../src/app.js"));
});

beforeEach(async () => {
  const { resetDatabase } = await import("./helpers.js");
  await resetDatabase();
});

describe("limite de tentativas", () => {
  it("bloqueia com 429 depois de 3 falhas de login", async () => {
    const attempt = () =>
      request(app).post("/api/auth/login").send({ email: "alvo@finn.test", password: "tentativa" });

    expect((await attempt()).status).toBe(401);
    expect((await attempt()).status).toBe(401);
    expect((await attempt()).status).toBe(401);

    const blocked = await attempt();

    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toContain("Muitas tentativas");
    expect(blocked.headers["retry-after"]).toBeDefined();
  });
});
