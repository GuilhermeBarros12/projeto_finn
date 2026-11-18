import { describe, expect, it } from "vitest";
import { envSchema } from "../src/config/env";

const base = {
  DATABASE_URL: "postgresql://finn:finn@localhost:5432/finn_db",
  JWT_SECRET: "x".repeat(32),
};

describe("validação das variáveis na subida (CONFIG-01)", () => {
  it.each(["0", "-5", "abc", "1.5"])("recusa SESSION_DAYS=%j", (value) => {
    expect(envSchema.safeParse({ ...base, SESSION_DAYS: value }).success).toBe(false);
  });

  it("usa 30 dias de sessão por padrão e as credenciais do Google são opcionais", () => {
    const result = envSchema.parse(base);

    expect(result.SESSION_DAYS).toBe(30);
    expect(result.GOOGLE_CLIENT_ID).toBeUndefined();
    expect(result.RESEND_API_KEY).toBeUndefined();
  });

  it("recusa fuso inexistente e aceita um fuso IANA", () => {
    expect(envSchema.safeParse({ ...base, APP_TIMEZONE: "Invalid/Zone" }).success).toBe(false);
    expect(envSchema.safeParse({ ...base, APP_TIMEZONE: "Europe/Lisbon" }).success).toBe(true);
  });

  it("explica o que fazer quando falta o banco", () => {
    const result = envSchema.safeParse({ JWT_SECRET: base.JWT_SECRET });

    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain("POSTGRES_HOST");
  });
});
