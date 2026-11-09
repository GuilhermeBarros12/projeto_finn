import { beforeEach, describe, expect, it } from "vitest";
import { csvValue } from "../src/controllers/export.controller";
import { prisma } from "../src/lib/prisma";
import {
  api,
  createCategory,
  createTransaction,
  createUser,
  resetDatabase,
  type TestUser,
} from "./helpers";

let user: TestUser;
let category: { id: string; name: string };

beforeEach(async () => {
  await resetDatabase();
  user = await createUser();
  category = await createCategory(user.token, { name: "Alimentação" });
});

describe("exportação", () => {
  it.each(["=1+1", "+1", "-1", "@SOMA(A1)", "\tcmd", "\rcmd"])(
    "neutraliza a fórmula %j",
    (value) => {
      expect(csvValue(value).startsWith(`"'`)).toBe(true);
    },
  );

  it("escapa aspas", () => {
    expect(csvValue('a"b')).toBe('"a""b"');
  });

  it("exporta além de uma página, sem repetir linhas", async () => {
    await prisma.transaction.createMany({
      data: Array.from({ length: 1205 }, (_, index) => ({
        userId: user.id,
        categoryId: category.id,
        type: "EXPENSE" as const,
        description: `Linha ${index}`,
        date: new Date(Date.UTC(2026, 2, 1 + (index % 28))),
        paymentMethod: "PIX" as const,
        value: 1,
      })),
    });

    const response = await api(user.token).get("/api/exports/transactions?format=csv");
    const rows = response.text.trim().split("\n").slice(1);
    const ids = rows.map((row) => row.split(",")[0]);

    expect(response.status).toBe(200);
    expect(rows).toHaveLength(1205);
    expect(new Set(ids).size).toBe(1205);
  });

  it("gera CSV com BOM, categoria e nome de download", async () => {
    await createTransaction(user.token, category.id, { description: "=HYPERLINK()" });

    const response = await api(user.token).get("/api/exports/transactions?format=csv");

    expect(response.text.charCodeAt(0)).toBe(0xfeff);
    expect(response.text).toContain('"Alimentação"');
    expect(response.text).toContain(`"'=HYPERLINK()"`);
    expect(response.headers["content-disposition"]).toContain("transacoes.csv");
  });

  it("aplica os filtros e gera JSON válido", async () => {
    await createTransaction(user.token, category.id, { date: "2026-03-10" });
    await createTransaction(user.token, category.id, { date: "2026-04-10" });

    const response = await api(user.token).get(
      "/api/exports/transactions?format=json&month=3&year=2026",
    );
    const body = JSON.parse(response.text);

    expect(body.meta.total).toBe(1);
    expect(body.data[0].category.name).toBe("Alimentação");
  });
});
