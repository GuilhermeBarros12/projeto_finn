import { beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "../generated/prisma/client";
import { globalCategories, seedGlobalCategories } from "../prisma/seed";
import { prisma } from "../src/lib/prisma";
import { api, createTransaction, createUser, resetDatabase } from "./helpers";

const client = prisma as unknown as PrismaClient;

beforeEach(resetDatabase);

describe("seed de categorias globais", () => {
  it("é idempotente", async () => {
    await seedGlobalCategories(client);
    await seedGlobalCategories(client);

    expect(await prisma.category.count({ where: { userId: null } })).toBe(globalCategories.length);
  });

  it("deixa o usuário novo lançar sem criar categoria", async () => {
    await seedGlobalCategories(client);
    const user = await createUser();

    const list = await api(user.token).get("/api/categories");
    const salary = list.body.categories.find(
      (category: { name: string }) => category.name === "Salário",
    );
    const created = await createTransaction(user.token, salary.id, { type: "INCOME" });

    expect(list.body.categories).toHaveLength(globalCategories.length);
    expect(created.status).toBe(201);
  });

  it("não deixa o usuário desativar uma categoria global", async () => {
    await seedGlobalCategories(client);
    const user = await createUser();
    const list = await api(user.token).get("/api/categories");

    const response = await api(user.token).patch(
      `/api/categories/${list.body.categories[0].id}/deactivate`,
    );

    expect(response.status).toBe(404);
  });
});
