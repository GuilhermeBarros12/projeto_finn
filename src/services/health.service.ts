import { AppError } from "../lib/app-error";
import { prisma } from "../lib/prisma";

export class HealthService {
  async check(): Promise<{ status: "ok" }> {
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      throw new AppError("Banco de dados indisponível.", 503, { cause: error });
    }

    return { status: "ok" };
  }
}
