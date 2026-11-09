import { execSync } from "node:child_process";
import { getTestDatabaseUrl } from "./test-database";

export default function setup(): void {
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: getTestDatabaseUrl() },
    stdio: "pipe",
  });
}
