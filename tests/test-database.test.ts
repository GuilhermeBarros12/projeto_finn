import { describe, expect, it } from "vitest";
import { getTestDatabaseUrl } from "./test-database";

const local = "postgresql://finn:finn@localhost:5432/finn_test";

describe("proteção do banco de teste (TEST-01)", () => {
  it("aceita banco local com test no nome", () => {
    expect(getTestDatabaseUrl({ TEST_DATABASE_URL: local })).toBe(local);
    expect(
      getTestDatabaseUrl({ TEST_DATABASE_URL: "postgresql://u:p@127.0.0.1/meu_test" }),
    ).toContain("127.0.0.1");
  });

  it("recusa banco sem test no nome", () => {
    expect(() =>
      getTestDatabaseUrl({ TEST_DATABASE_URL: "postgresql://u:p@localhost/finn_db" }),
    ).toThrow(/precisa conter "test"/);
  });

  it("recusa servidor remoto, a menos que isso seja liberado de propósito", () => {
    const remote = "postgresql://u:p@banco.empresa.com:5432/finn_test";

    expect(() => getTestDatabaseUrl({ TEST_DATABASE_URL: remote })).toThrow(/banco local/);
    expect(
      getTestDatabaseUrl({ TEST_DATABASE_URL: remote, TEST_DATABASE_ALLOW_REMOTE: "true" }),
    ).toBe(remote);
  });

  it("recusa o mesmo banco usado pelo app", () => {
    expect(() =>
      getTestDatabaseUrl(
        { TEST_DATABASE_URL: local },
        { compareWith: "postgresql://outro:senha@localhost/finn_test?schema=public" },
      ),
    ).toThrow(/mesmo banco/);
  });

  it("exige a variável", () => {
    expect(() => getTestDatabaseUrl({})).toThrow(/Defina TEST_DATABASE_URL/);
  });
});
