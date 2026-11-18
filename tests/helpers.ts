import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";

export interface TestUser {
  id: string;
  email: string;
  password: string;
  /** Token de sessão para Authorization: Bearer, o caminho do aplicativo. */
  token: string;
  /** Cookie de sessão, o caminho da tela. */
  cookie: string;
}

// Igual ao FRONTEND_ORIGIN de tests/setup.ts: o Better Auth confere a origem dos POSTs.
export const ORIGIN = "http://localhost:5173";

let sequence = 0;

export const resetDatabase = async (): Promise<void> => {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "Session", "Account", "Verification", "Transaction", "Recurrence", "Card", "Goal", "Category", "User" CASCADE',
  );
};

/** POST nas rotas do Better Auth, já com a origem da tela. */
export const authPost = (path: string, body: object = {}) =>
  request(app).post(`/api/auth${path}`).set("Origin", ORIGIN).send(body);

export const sessionCookieFrom = (response: request.Response): string => {
  const cookies = response.headers["set-cookie"] as unknown as string[] | undefined;
  const cookie = cookies?.find((value) => value.startsWith("finn.session_token="));
  if (!cookie) throw new Error("Resposta sem cookie de sessão.");
  return cookie.split(";")[0] as string;
};

export const signIn = async (email: string, password: string) => {
  const response = await authPost("/sign-in/email", { email, password });
  return {
    response,
    token: response.headers["set-auth-token"] as string,
    cookie: response.status === 200 ? sessionCookieFrom(response) : "",
  };
};

export const createUser = async (): Promise<TestUser> => {
  sequence += 1;
  const email = `pessoa${sequence}@finn.test`;
  const password = "senha-segura-123";

  // O cadastro já abre a sessão.
  const created = await authPost("/sign-up/email", { name: "Pessoa", email, password });

  return {
    id: created.body.user.id,
    email,
    password,
    token: created.headers["set-auth-token"] as string,
    cookie: sessionCookieFrom(created),
  };
};

export const api = (token: string) => ({
  get: (url: string) => request(app).get(url).set("Authorization", `Bearer ${token}`),
  post: (url: string) => request(app).post(url).set("Authorization", `Bearer ${token}`),
  put: (url: string) => request(app).put(url).set("Authorization", `Bearer ${token}`),
  patch: (url: string) => request(app).patch(url).set("Authorization", `Bearer ${token}`),
  delete: (url: string) => request(app).delete(url).set("Authorization", `Bearer ${token}`),
});

export const createCategory = async (
  token: string,
  overrides: { name?: string; type?: "INCOME" | "EXPENSE" } = {},
): Promise<{ id: string; name: string }> => {
  const response = await api(token)
    .post("/api/categories")
    .send({ name: "Mercado", type: "EXPENSE", icon: "Utensils", color: "#163300", ...overrides });
  return response.body.category;
};

export const createCard = async (
  token: string,
  overrides: Record<string, unknown> = {},
): Promise<{ id: string; name: string; isDefault: boolean }> => {
  const response = await api(token)
    .post("/api/cards")
    .send({ name: "Cartão", closingDay: 25, dueDay: 5, ...overrides });
  return response.body.card;
};

export const createTransaction = async (
  token: string,
  categoryId: string,
  overrides: Record<string, unknown> = {},
) => {
  const response = await api(token)
    .post("/api/transactions")
    .send({
      categoryId,
      type: "EXPENSE",
      description: "Compra",
      date: "2026-03-15",
      paymentMethod: "PIX",
      value: 100,
      ...overrides,
    });
  return response;
};
