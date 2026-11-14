import { app } from "./app";
import { env, ignoredVariables } from "./config/env";
import { logger } from "./lib/logger";
import { prisma } from "./lib/prisma";

const SHUTDOWN_TIMEOUT_MS = 10_000;

const server = app.listen(env.PORT, () => {
  logger.info(`API disponível em http://localhost:${env.PORT}/api`);

  for (const [old, replacement] of ignoredVariables) {
    logger.warn(`${old} não é mais usada e foi ignorada. Use ${replacement}.`);
  }
});

const shutdown = (signal: string): void => {
  logger.info({ signal }, "Encerrando a API");

  const forceExit = setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  // Primeiro para de aceitar requisições; só depois fecha o banco que elas ainda usam.
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Promise rejeitada sem tratamento");
});
process.on("uncaughtException", (error) => {
  logger.fatal({ err: error }, "Exceção não capturada");
  process.exit(1);
});
