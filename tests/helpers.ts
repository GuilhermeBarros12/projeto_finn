import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";

export interface TestUser {
  id: string;
  email: string;
  password: string;
  token: string;
  cookie: string;
}

let sequence = 0;

export const resetDatabase = async (): Promise<void> => {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "RefreshToken", "Transaction", "Goal", "Category", "User" CASCADE',
  );
};

export const refreshCookieFrom = (response: request.Response): string => {
  const cookies = response.headers["set-cookie"] as unknown as string[] | undefined;
  const cookie = cookies?.find((value) => value.startsWith("finn_refresh="));
  if (!cookie) throw new Error("Resposta sem cookie de sessão.");
  return cookie.split(";")[0] as string;
};

export const createUser = async (): Promise<TestUser> => {
  sequence += 1;
  const email = `pessoa${sequence}@finn.test`;
  const password = "senha-segura-123";

  const created = await request(app).post("/api/users").send({ name: "Pessoa", email, password });
  const login = await request(app).post("/api/auth/login").send({ email, password });

  return {
    id: created.body.user.id,
    email,
    password,
    token: login.body.token,
    cookie: refreshCookieFrom(login),
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
