import { describe, expect, it } from "vitest";
import { resolveDatabaseUrl } from "../src/config/database-url";

const parts = {
  POSTGRES_HOST: "db",
  POSTGRES_USER: "finn",
  POSTGRES_PASSWORD: "p@ss:w/rd#?%&=",
  POSTGRES_DB: "finn_db",
};

describe("URL do banco (DEPLOY-01)", () => {
  it("codifica senha com caracteres reservados", () => {
    const url = new URL(resolveDatabaseUrl(parts) as string);

    expect(url.hostname).toBe("db");
    expect(url.port).toBe("5432");
    expect(url.pathname).toBe("/finn_db");
    expect(decodeURIComponent(url.username)).toBe("finn");
    expect(decodeURIComponent(url.password)).toBe("p@ss:w/rd#?%&=");
    expect(url.searchParams.get("schema")).toBe("public");
  });

  it("prefere DATABASE_URL quando ela existe", () => {
    expect(resolveDatabaseUrl({ ...parts, DATABASE_URL: "postgresql://a:b@c/d" })).toBe(
      "postgresql://a:b@c/d",
    );
  });

  it("não inventa URL quando falta alguma parte", () => {
    expect(resolveDatabaseUrl({ POSTGRES_HOST: "db", POSTGRES_USER: "finn" })).toBeUndefined();
  });
});
