import "dotenv/config";

type Environment = Record<string, string | undefined>;

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

const sameDatabase = (first: string, second: string): boolean => {
  const a = new URL(first);
  const b = new URL(second);
  return (
    a.hostname === b.hostname &&
    (a.port || "5432") === (b.port || "5432") &&
    a.pathname === b.pathname
  );
};

/**
 * A suíte apaga tudo entre um teste e outro. Por isso recusa banco sem "test" no nome, servidor
 * que não seja local (salvo liberação explícita) e o mesmo banco que o app usa.
 */
export const getTestDatabaseUrl = (
  env: Environment = process.env,
  { compareWith }: { compareWith?: string | undefined } = {},
): string => {
  const url = env.TEST_DATABASE_URL;

  if (!url) {
    throw new Error("Defina TEST_DATABASE_URL (veja .env.example) para rodar os testes.");
  }

  const parsed = new URL(url);
  const databaseName = parsed.pathname.slice(1);

  if (!databaseName.toLowerCase().includes("test")) {
    throw new Error(`Banco "${databaseName}" recusado: o nome precisa conter "test".`);
  }

  if (!LOCAL_HOSTS.has(parsed.hostname) && env.TEST_DATABASE_ALLOW_REMOTE !== "true") {
    throw new Error(
      `Servidor "${parsed.hostname}" recusado: os testes só rodam em banco local. ` +
        "Para um servidor descartável, defina TEST_DATABASE_ALLOW_REMOTE=true.",
    );
  }

  if (compareWith && sameDatabase(url, compareWith)) {
    throw new Error(
      "TEST_DATABASE_URL aponta para o mesmo banco de DATABASE_URL. Use outro banco.",
    );
  }

  return url;
};
