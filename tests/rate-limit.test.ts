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
      request(app)
        .post("/api/auth/sign-in/email")
        .set("Origin", "http://localhost:5173")
        .send({ email: "alvo@finn.test", password: "tentativa" });

    expect((await attempt()).status).toBe(401);
    expect((await attempt()).status).toBe(401);
    expect((await attempt()).status).toBe(401);

    const blocked = await attempt();

    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toContain("Muitas tentativas");
    expect(blocked.headers["retry-after"]).toBeDefined();
  });

  it("limita os pedidos de redefinição por e-mail, sem afetar outros endereços", async () => {
    const attempt = (email: string) =>
      request(app)
        .post("/api/auth/request-password-reset")
        .set("Origin", "http://localhost:5173")
        .send({ email, redirectTo: "http://localhost:5173/redefinir-senha" });

    expect((await attempt("alvo@finn.test")).status).toBe(200);
    expect((await attempt("ALVO@finn.test")).status).toBe(200);
    expect((await attempt("alvo@finn.test")).status).toBe(200);

    const blocked = await attempt("alvo@finn.test");
    const other = await attempt("outra@finn.test");

    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toContain("Muitas tentativas");
    expect(other.status).toBe(200);
  });
});
