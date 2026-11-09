import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { api, createUser, resetDatabase } from "./helpers";

beforeEach(resetDatabase);

describe("comportamento HTTP", () => {
  it("responde 400 para JSON malformado", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send("{quebrado");

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("JSON");
  });

  it("responde 413 para corpo grande demais", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "a@b.co", password: "x".repeat(200_000) });

    expect(response.status).toBe(413);
  });

  it("responde 404 em JSON para rota desconhecida", async () => {
    const response = await request(app).get("/api/nao-existe");

    expect(response.status).toBe(404);
    expect(response.body.message).toContain("não encontrada");
  });

  it("não expõe detalhes internos em um erro 500", async () => {
    const { token } = await createUser();
    const spy = vi
      .spyOn(prisma.category, "findMany")
      .mockRejectedValueOnce(new Error("senha do banco vazou"));

    const response = await api(token).get("/api/categories");
    spy.mockRestore();

    expect(response.status).toBe(500);
    expect(response.text).not.toContain("senha do banco");
  });

  it("responde 503 quando o banco está fora", async () => {
    const spy = vi.spyOn(prisma, "$queryRaw").mockRejectedValueOnce(new Error("fora do ar"));

    const response = await request(app).get("/api/health");
    spy.mockRestore();

    expect(response.status).toBe(503);
  });

  it("envia os cabeçalhos do helmet e esconde o Express", async () => {
    const response = await request(app).get("/api/health");

    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["content-security-policy"]).toBeDefined();
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });

  it("libera CORS só para o frontend, com credenciais", async () => {
    const allowed = await request(app).get("/api/health").set("Origin", "http://localhost:5173");

    expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(allowed.headers["access-control-allow-credentials"]).toBe("true");
  });
});
