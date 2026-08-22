import { prisma } from "../lib/prisma";

export class HealthService {
  async check(): Promise<{ status: "ok" }> {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "ok" };
  }
}
