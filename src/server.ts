import { app } from "./app";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";

const server = app.listen(env.PORT, () => {
  console.log(`API disponível em http://localhost:${env.PORT}/api`);
});

const shutdown = async (): Promise<void> => {
  await prisma.$disconnect();
  server.close(() => process.exit(0));
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
