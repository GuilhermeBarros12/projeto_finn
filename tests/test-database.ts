import "dotenv/config";

/** Recusa qualquer banco sem "test" no nome: a suíte apaga tudo entre um teste e outro. */
export const getTestDatabaseUrl = (): string => {
  const url = process.env.TEST_DATABASE_URL;

  if (!url) {
    throw new Error("Defina TEST_DATABASE_URL (veja .env.example) para rodar os testes.");
  }

  const databaseName = new URL(url).pathname.slice(1);

  if (!databaseName.toLowerCase().includes("test")) {
    throw new Error(`Banco "${databaseName}" recusado: o nome precisa conter "test".`);
  }

  return url;
};
