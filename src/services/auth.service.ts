import { createHash, randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { env } from "../config/env";
import { AppError } from "../lib/app-error";
import { addUtcDays } from "../lib/dates";
import { signAccessToken } from "../lib/jwt";
import { prisma } from "../lib/prisma";
import type { LoginInput } from "../schemas/auth.schema";
import { PASSWORD_SALT_ROUNDS, toPublicUser, type PublicUser } from "./user.service";

/** Abas abertas podem renovar ao mesmo tempo; dentro desta janela não é tentativa de roubo. */
const ROTATION_GRACE_MS = 30_000;

export interface Session {
  token: string;
  user: PublicUser;
  refreshToken: string;
  refreshExpiresAt: Date;
}

const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");

// Quem não existe também passa pelo bcrypt, senão o tempo de resposta revelaria os e-mails.
const dummyHash = bcrypt.hash(randomBytes(16).toString("hex"), PASSWORD_SALT_ROUNDS);

export class AuthService {
  private async issueRefreshToken(
    userId: string,
    familyId: string,
  ): Promise<{ refreshToken: string; refreshExpiresAt: Date }> {
    const refreshToken = randomBytes(32).toString("base64url");
    const refreshExpiresAt = addUtcDays(new Date(), env.REFRESH_TOKEN_DAYS);

    await prisma.refreshToken.create({
      data: { userId, familyId, tokenHash: hashToken(refreshToken), expiresAt: refreshExpiresAt },
    });

    return { refreshToken, refreshExpiresAt };
  }

  async login({ email, password }: LoginInput): Promise<Session> {
    const user = await prisma.user.findUnique({ where: { email } });
    const passwordMatches = await bcrypt.compare(password, user?.password ?? (await dummyHash));

    if (!user || !passwordMatches) {
      throw new AppError("E-mail ou senha inválidos.", 401);
    }

    await prisma.refreshToken.deleteMany({
      where: { userId: user.id, expiresAt: { lt: new Date() } },
    });

    return {
      token: signAccessToken(user.id),
      user: toPublicUser(user),
      ...(await this.issueRefreshToken(user.id, randomUUID())),
    };
  }

  async refresh(token: string | undefined): Promise<Session> {
    const invalidSession = new AppError("Sessão inválida ou expirada.", 401);
    if (!token) throw invalidSession;

    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });

    if (!stored || stored.expiresAt <= new Date()) throw invalidSession;

    const reused =
      stored.rotatedAt !== null && Date.now() - stored.rotatedAt.getTime() > ROTATION_GRACE_MS;

    if (reused) {
      // Token antigo voltando é sinal de vazamento: derruba toda a cadeia dessa sessão.
      await prisma.refreshToken.deleteMany({ where: { familyId: stored.familyId } });
      throw invalidSession;
    }

    await prisma.refreshToken.updateMany({
      where: { id: stored.id, rotatedAt: null },
      data: { rotatedAt: new Date() },
    });

    return {
      token: signAccessToken(stored.userId),
      user: toPublicUser(stored.user),
      ...(await this.issueRefreshToken(stored.userId, stored.familyId)),
    };
  }

  async logout(token: string | undefined): Promise<void> {
    if (!token) return;

    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(token) },
      select: { familyId: true },
    });

    if (stored) await prisma.refreshToken.deleteMany({ where: { familyId: stored.familyId } });
  }
}
