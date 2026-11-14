import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Express } from "express";

let app: Express;

beforeAll(async () => {
  vi.stubEnv("SIGNUP_ALLOWED_EMAILS", "Dono@Finn.test, outra@finn.test");
  vi.resetModules();
  ({ app } = await import("../src/app.js"));
});

beforeEach(async () => {
  const { resetDatabase } = await import("./helpers.js");
  await resetDatabase();
});

const signup = (email: string) =>
  request(app).post("/api/users").send({ name: "Pessoa", email, password: "senha-segura-123" });

describe("cadastro restrito por e-mail", () => {
  it("aceita os e-mails da lista, sem diferenciar maiúsculas", async () => {
    expect((await signup("dono@finn.test")).status).toBe(201);
    expect((await signup("OUTRA@finn.test")).status).toBe(201);
  });

  it("recusa qualquer outro e-mail com 403", async () => {
    const response = await signup("estranho@finn.test");

    expect(response.status).toBe(403);
    expect(response.body.message).toContain("fechado");
  });
});
