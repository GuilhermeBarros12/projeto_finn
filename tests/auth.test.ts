import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { api, createUser, refreshCookieFrom, resetDatabase } from "./helpers";

beforeEach(resetDatabase);

describe("cadastro e login", () => {
  it("guarda a senha como hash e nunca a devolve", async () => {
    const response = await request(app)
      .post("/api/users")
      .send({ name: "Ana", email: "ANA@finn.test", password: "senha-segura-123" });

    expect(response.status).toBe(201);
    expect(response.body.user.email).toBe("ana@finn.test");
    expect(response.body.user).not.toHaveProperty("password");

    const stored = await prisma.user.findUniqueOrThrow({ where: { email: "ana@finn.test" } });
    expect(stored.password).not.toContain("senha-segura-123");
  });

  it("rejeita senha curta com mensagem que o usuário entende", async () => {
    const response = await request(app)
      .post("/api/users")
      .send({ name: "Ana", email: "ana@finn.test", password: "123" });

    expect(response.status).toBe(400);
    expect(response.body.issues[0].message).toContain("8 caracteres");
  });

  it("rejeita senha que o bcrypt cortaria silenciosamente", async () => {
    const response = await request(app)
      .post("/api/users")
      .send({ name: "Ana", email: "ana@finn.test", password: "é".repeat(40) });

    expect(response.status).toBe(400);
  });

  it("responde igual para senha errada e e-mail inexistente", async () => {
    const user = await createUser();
    const wrongPassword = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: "senha-errada" });
    const unknownEmail = await request(app)
      .post("/api/auth/login")
      .send({ email: "ninguem@finn.test", password: "senha-errada" });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
  });
});

describe("token de acesso", () => {
  it("bloqueia rota protegida sem token ou com token adulterado", async () => {
    const { token } = await createUser();

    expect((await request(app).get("/api/categories")).status).toBe(401);
    expect((await api(`${token}x`).get("/api/categories")).status).toBe(401);
  });

  it("recusa token assinado com outro segredo", async () => {
    const forged = jwt.sign({}, "outro-segredo-qualquer-com-mais-de-32-chars", {
      subject: "qualquer-usuario",
    });

    expect((await api(forged).get("/api/categories")).status).toBe(401);
  });

  it("recusa token sem assinatura (alg none)", async () => {
    const forged = jwt.sign({}, "", { algorithm: "none", subject: "qualquer-usuario" });

    expect((await api(forged).get("/api/categories")).status).toBe(401);
  });

  it("expira em 15 minutos por padrão", async () => {
    const { token } = await createUser();
    const payload = jwt.decode(token) as { iat: number; exp: number };

    expect(payload.exp - payload.iat).toBe(15 * 60);
  });
});

describe("renovação de sessão", () => {
  it("entrega o refresh token apenas em cookie HttpOnly", async () => {
    const user = await createUser();
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: user.password });
    const header = (login.headers["set-cookie"] as unknown as string[]).join(";");

    expect(header).toContain("HttpOnly");
    expect(header).toContain("SameSite=Strict");
    expect(header).toContain("Path=/api/auth");
    expect(login.body).not.toHaveProperty("refreshToken");
  });

  it("guarda só o hash do refresh token no banco", async () => {
    const user = await createUser();
    const raw = user.cookie.split("=")[1] as string;
    const stored = await prisma.refreshToken.findFirstOrThrow({ where: { userId: user.id } });

    expect(stored.tokenHash).not.toBe(raw);
  });

  it("renova a sessão e entrega um token de acesso que funciona", async () => {
    const user = await createUser();
    const refreshed = await request(app).post("/api/auth/refresh").set("Cookie", user.cookie);

    expect(refreshed.status).toBe(200);
    expect(refreshed.body.user.email).toBe(user.email);
    expect((await api(refreshed.body.token).get("/api/categories")).status).toBe(200);
    expect(refreshCookieFrom(refreshed)).not.toBe(user.cookie);
  });

  it("recusa renovar sem cookie ou com cookie desconhecido", async () => {
    expect((await request(app).post("/api/auth/refresh")).status).toBe(401);
    expect(
      (await request(app).post("/api/auth/refresh").set("Cookie", "finn_refresh=falso")).status,
    ).toBe(401);
  });

  it("tolera duas abas renovando ao mesmo tempo", async () => {
    const user = await createUser();
    const first = await request(app).post("/api/auth/refresh").set("Cookie", user.cookie);
    const second = await request(app).post("/api/auth/refresh").set("Cookie", user.cookie);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
  });

  it("derruba a sessão inteira quando um token antigo é reutilizado", async () => {
    const user = await createUser();
    const rotated = await request(app).post("/api/auth/refresh").set("Cookie", user.cookie);
    const current = refreshCookieFrom(rotated);

    // Simula o token antigo voltando depois da janela de tolerância.
    await prisma.refreshToken.updateMany({
      where: { userId: user.id, rotatedAt: { not: null } },
      data: { rotatedAt: new Date(Date.now() - 60_000) },
    });

    const replay = await request(app).post("/api/auth/refresh").set("Cookie", user.cookie);
    const victim = await request(app).post("/api/auth/refresh").set("Cookie", current);

    expect(replay.status).toBe(401);
    expect(victim.status).toBe(401);
    expect(await prisma.refreshToken.count({ where: { userId: user.id } })).toBe(0);
  });

  it("recusa refresh token expirado", async () => {
    const user = await createUser();
    await prisma.refreshToken.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const response = await request(app).post("/api/auth/refresh").set("Cookie", user.cookie);
    expect(response.status).toBe(401);
  });

  it("encerra a sessão no logout, sem janela de tolerância", async () => {
    const user = await createUser();

    const logout = await request(app).post("/api/auth/logout").set("Cookie", user.cookie);
    const replay = await request(app).post("/api/auth/refresh").set("Cookie", user.cookie);

    expect(logout.status).toBe(204);
    expect(replay.status).toBe(401);
  });
});
