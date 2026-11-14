import { execSync } from "node:child_process";
import { getTestDatabaseUrl } from "./test-database";

export default function setup(): void {
  // Só aqui o DATABASE_URL ainda é o do app; o setup de cada arquivo troca ele pelo de teste.
  const url = getTestDatabaseUrl(process.env, { compareWith: process.env.DATABASE_URL });

  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });
}
