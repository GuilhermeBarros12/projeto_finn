import bcrypt from "bcryptjs";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { sentEmails } from "../src/lib/mailer";
import { prisma } from "../src/lib/prisma";
import { api, authPost, createUser, resetDatabase, signIn } from "./helpers";

beforeEach(async () => {
  sentEmails.length = 0;
  await resetDatabase();
});

describe("cadastro", () => {
  it("guarda a senha como hash bcrypt e nunca a devolve", async () => {
    const response = await authPost("/sign-up/email", {
      name: "Ana",
      email: "ANA@finn.test",
      password: "senha-segura-123",
    });

    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe("ana@finn.test");
    expect(JSON.stringify(response.body)).not.toContain("senha-segura-123");

    const account = await prisma.account.findFirstOrThrow({
      where: { providerId: "credential", user: { email: "ana@finn.test" } },
    });
    expect(account.password).not.toContain("senha-segura-123");
    expect(await bcrypt.compare("senha-segura-123", account.password as string)).toBe(true);
  });

  it("recusa senha curta", async () => {
    const response = await authPost("/sign-up/email", {
      name: "Ana",
      email: "ana@finn.test",
      password: "123",
    });

    expect(response.status).toBe(400);
    expect(await prisma.user.count()).toBe(0);
  });

  it("recusa senha que o bcrypt cortaria silenciosamente", async () => {
    const response = await authPost("/sign-up/email", {
      name: "Ana",
      email: "ana@finn.test",
      password: "é".repeat(40),
    });

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(await prisma.user.count()).toBe(0);
  });

  it("recusa e-mail repetido", async () => {
    const user = await createUser();
    const response = await authPost("/sign-up/email", {
      name: "Outra",
      email: user.email.toUpperCase(),
      password: "outra-senha-123",
    });

    expect(response.status).toBe(422);
    expect(await prisma.user.count()).toBe(1);
  });
});

describe("login", () => {
  it("entrega a sessão só em cookie HttpOnly", async () => {
    const user = await createUser();
    const { response } = await signIn(user.email, user.password);
    const header = (response.headers["set-cookie"] as unknown as string[]).join(";");

    expect(response.status).toBe(200);
    expect(header).toContain("HttpOnly");
    expect(header).toContain("SameSite=Lax");
    expect(header).toContain("Path=/");
    expect(response.body.user.email).toBe(user.email);
  });

  it("responde igual para senha errada e e-mail inexistente", async () => {
    const user = await createUser();
    const wrongPassword = await signIn(user.email, "senha-errada");
    const unknownEmail = await signIn("ninguem@finn.test", "senha-errada");

    expect(wrongPassword.response.status).toBe(401);
    expect(unknownEmail.response.status).toBe(401);
    expect(wrongPassword.response.body).toEqual(unknownEmail.response.body);
  });

  it("aceita a senha bcrypt de quem já tinha conta antes do Better Auth", async () => {
    const user = await prisma.user.create({
      data: { name: "Antiga", email: "antiga@finn.test" },
    });
    await prisma.account.create({
      data: {
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        password: await bcrypt.hash("senha-do-passado-1", 10),
      },
    });

    const { response } = await signIn("antiga@finn.test", "senha-do-passado-1");

    expect(response.status).toBe(200);
    expect((await signIn("antiga@finn.test", "outra-senha-1234")).response.status).toBe(401);
  });

  it("não aceita senha que passe de 72 bytes, onde o bcrypt ignoraria o resto", async () => {
    const user = await createUser();
    const { response } = await signIn(user.email, `${user.password}${"x".repeat(80)}`);

    expect(response.status).toBe(401);
  });
});

describe("sessão", () => {
  it("libera rota protegida por cookie e por token no cabeçalho", async () => {
    const user = await createUser();

    const byCookie = await request(app).get("/api/categories").set("Cookie", user.cookie);
    const byToken = await api(user.token).get("/api/categories");

    expect(byCookie.status).toBe(200);
    expect(byToken.status).toBe(200);
  });

  it("bloqueia rota protegida sem sessão ou com sessão adulterada", async () => {
    const { token, cookie } = await createUser();

    expect((await request(app).get("/api/categories")).status).toBe(401);
    expect((await api(`${token}x`).get("/api/categories")).status).toBe(401);
    expect((await request(app).get("/api/categories").set("Cookie", `${cookie}x`)).status).toBe(
      401,
    );
    expect((await api("qualquer-coisa").get("/api/categories")).status).toBe(401);
  });

  it("recusa a sessão depois que ela expira", async () => {
    const user = await createUser();
    await prisma.session.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    expect((await request(app).get("/api/categories").set("Cookie", user.cookie)).status).toBe(401);
  });

  it("dura 30 dias por padrão", async () => {
    const user = await createUser();
    const session = await prisma.session.findFirstOrThrow({ where: { userId: user.id } });
    const days = (session.expiresAt.getTime() - Date.now()) / 86_400_000;

    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThanOrEqual(30);
  });

  it("encerra a sessão no logout", async () => {
    const user = await createUser();

    const logout = await request(app)
      .post("/api/auth/sign-out")
      .set("Origin", "http://localhost:5173")
      .set("Cookie", user.cookie);

    expect(logout.status).toBe(200);
    expect((await request(app).get("/api/categories").set("Cookie", user.cookie)).status).toBe(401);
    expect((await api(user.token).get("/api/categories")).status).toBe(401);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
  });

  it("recusa POST vindo de outra origem", async () => {
    const user = await createUser();

    const response = await request(app)
      .post("/api/auth/sign-out")
      .set("Origin", "https://site-malicioso.test")
      .set("Cookie", user.cookie);

    expect(response.status).toBe(403);
    expect((await request(app).get("/api/categories").set("Cookie", user.cookie)).status).toBe(200);
  });
});

describe("esqueci a senha", () => {
  const requestReset = (email: string) =>
    authPost("/request-password-reset", {
      email,
      redirectTo: "http://localhost:5173/redefinir-senha",
    });

  /** O link que chegaria por e-mail, e o token que a tela devolve ao enviar a senha nova. */
  const emailedToken = (): string => {
    const url = sentEmails.at(-1)?.text.match(/https?:\/\/\S+/)?.[0];
    if (!url) throw new Error("Nenhum e-mail com link foi enviado.");
    return new URL(url).pathname.split("/").pop() as string;
  };

  it("responde igual para e-mail cadastrado e desconhecido, e só envia ao primeiro", async () => {
    const user = await createUser();

    const known = await requestReset(user.email);
    const unknown = await requestReset("ninguem@finn.test");

    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body).toEqual(unknown.body);
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0]?.to).toBe(user.email);
  });

  it("troca a senha com o link, que vale uma vez só", async () => {
    const user = await createUser();
    await requestReset(user.email);
    const token = emailedToken();

    const reset = await authPost("/reset-password", { token, newPassword: "senha-nova-456" });
    const reuse = await authPost("/reset-password", { token, newPassword: "outra-senha-789" });

    expect(reset.status).toBe(200);
    expect(reuse.status).toBe(400);
    expect((await signIn(user.email, user.password)).response.status).toBe(401);
    expect((await signIn(user.email, "senha-nova-456")).response.status).toBe(200);
  });

  it("derruba as sessões abertas quando a senha muda", async () => {
    const user = await createUser();
    await requestReset(user.email);

    await authPost("/reset-password", { token: emailedToken(), newPassword: "senha-nova-456" });

    expect((await request(app).get("/api/categories").set("Cookie", user.cookie)).status).toBe(401);
    expect((await api(user.token).get("/api/categories")).status).toBe(401);
  });

  it("recusa o link depois de 1 hora", async () => {
    const user = await createUser();
    await requestReset(user.email);
    const token = emailedToken();
    await prisma.verification.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

    const reset = await authPost("/reset-password", { token, newPassword: "senha-nova-456" });

    expect(reset.status).toBe(400);
    expect((await signIn(user.email, user.password)).response.status).toBe(200);
  });

  it("recusa senha nova curta ou token inventado", async () => {
    const user = await createUser();
    await requestReset(user.email);

    const short = await authPost("/reset-password", { token: emailedToken(), newPassword: "123" });
    const forged = await authPost("/reset-password", {
      token: "inventado",
      newPassword: "senha-nova-456",
    });

    expect(short.status).toBe(400);
    expect(forged.status).toBe(400);
    expect((await signIn(user.email, user.password)).response.status).toBe(200);
  });

  it("não manda o link para um endereço de redirecionamento de fora", async () => {
    const user = await createUser();

    const response = await authPost("/request-password-reset", {
      email: user.email,
      redirectTo: "https://site-malicioso.test/capturar",
    });

    expect(response.status).toBe(403);
    expect(sentEmails).toHaveLength(0);
  });
});

describe("login com Google", () => {
  it("fica desligado sem as credenciais, e a tela é avisada", async () => {
    const config = await request(app).get("/api/config");
    const social = await authPost("/sign-in/social", { provider: "google", callbackURL: "/" });

    expect(config.body).toEqual({ googleLogin: false });
    expect(social.status).toBeGreaterThanOrEqual(400);
  });
});
