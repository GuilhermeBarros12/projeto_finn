import { describe, expect, it } from "vitest";
import { envSchema } from "../src/config/env";

const base = {
  DATABASE_URL: "postgresql://finn:finn@localhost:5432/finn_db",
  JWT_SECRET: "x".repeat(32),
};

describe("validação das variáveis na subida (CONFIG-01)", () => {
  it.each(["abc", "900", "3600", "10s", "", "-5m"])(
    "recusa ACCESS_TOKEN_EXPIRES_IN=%j",
    (value) => {
      expect(envSchema.safeParse({ ...base, ACCESS_TOKEN_EXPIRES_IN: value }).success).toBe(false);
    },
  );

  it.each(["15m", "1h", "2 hours", "1d"])("aceita ACCESS_TOKEN_EXPIRES_IN=%j", (value) => {
    expect(envSchema.safeParse({ ...base, ACCESS_TOKEN_EXPIRES_IN: value }).success).toBe(true);
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
