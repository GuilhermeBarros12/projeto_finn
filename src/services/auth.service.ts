import { createHash, randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Prisma } from "../../generated/prisma/client";
import { env } from "../config/env";
import { AppError } from "../lib/app-error";
import { addUtcDays } from "../lib/dates";
import { signAccessToken } from "../lib/jwt";
import { prisma } from "../lib/prisma";
import type { LoginInput } from "../schemas/auth.schema";
import { PASSWORD_SALT_ROUNDS, toPublicUser, type PublicUser } from "./user.service";

/** Abas abertas podem renovar ao mesmo tempo; dentro desta janela não é tentativa de roubo. */
const ROTATION_GRACE_MS = 30_000;

interface RefreshGrant {
  token: string;
  expiresAt: Date;
}

export interface Session {
  token: string;
  user: PublicUser;
  /** Nulo na janela de tolerância: o navegador já recebeu o sucessor do token. */
  refresh: RefreshGrant | null;
}

const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");

// Quem não existe também passa pelo bcrypt, senão o tempo de resposta revelaria os e-mails.
const dummyHash = bcrypt.hash(randomBytes(16).toString("hex"), PASSWORD_SALT_ROUNDS);

/**
 * Renovação e logout da mesma sessão rodam um de cada vez. Uma trava de linha não bastaria:
 * o DELETE do logout não enxerga um token inserido depois que ele começou.
 */
const lockFamily = async (tx: Prisma.TransactionClient, familyId: string): Promise<void> => {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${familyId}, 0))`;
};

export class AuthService {
  private async issueRefreshToken(
    db: Prisma.TransactionClient,
    userId: string,
    familyId: string,
  ): Promise<RefreshGrant> {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = addUtcDays(new Date(), env.REFRESH_TOKEN_DAYS);

    await db.refreshToken.create({
      data: { userId, familyId, tokenHash: hashToken(token), expiresAt },
    });

    return { token, expiresAt };
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
      refresh: await this.issueRefreshToken(prisma, user.id, randomUUID()),
    };
  }

  async refresh(token: string | undefined): Promise<Session> {
    const invalidSession = new AppError("Sessão inválida ou expirada.", 401);
    if (!token) throw invalidSession;

    const tokenHash = hashToken(token);
    const found = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      select: { familyId: true },
    });
    if (!found) throw invalidSession;

    const renewal = await prisma.$transaction(async (tx) => {
      await lockFamily(tx, found.familyId);

      // Relê depois da trava: um logout pode ter apagado o token nesse intervalo.
      const stored = await tx.refreshToken.findUnique({
        where: { tokenHash },
        include: { user: true },
      });
      if (!stored || stored.expiresAt <= new Date()) return null;

      if (stored.rotatedAt === null) {
        await tx.refreshToken.update({
          where: { id: stored.id },
          data: { rotatedAt: new Date() },
        });
        const refresh = await this.issueRefreshToken(tx, stored.userId, stored.familyId);
        return { user: stored.user, refresh };
      }

      // Dentro da tolerância entrega só o token de acesso, para nunca bifurcar a sessão.
      if (Date.now() - stored.rotatedAt.getTime() <= ROTATION_GRACE_MS) {
        return { user: stored.user, refresh: null };
      }

      // Token antigo voltando é sinal de vazamento: derruba toda a cadeia dessa sessão.
      await tx.refreshToken.deleteMany({ where: { familyId: stored.familyId } });
      return null;
    });

    if (!renewal) throw invalidSession;

    return {
      token: signAccessToken(renewal.user.id),
      user: toPublicUser(renewal.user),
      refresh: renewal.refresh,
    };
  }

  async logout(token: string | undefined): Promise<void> {
    if (!token) return;

    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(token) },
      select: { familyId: true },
    });
    if (!stored) return;

    await prisma.$transaction(async (tx) => {
      await lockFamily(tx, stored.familyId);
      await tx.refreshToken.deleteMany({ where: { familyId: stored.familyId } });
    });
  }
}
