import bcrypt from "bcryptjs";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { bearer } from "better-auth/plugins";
import { env } from "../config/env";
import { sendPasswordResetEmail } from "./mailer";
import { prisma } from "./prisma";

export const PASSWORD_SALT_ROUNDS = 12;
const MAX_PASSWORD_BYTES = 72;
const ONE_DAY = 60 * 60 * 24;

export const googleEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

/**
 * Login, cadastro, sessão, "esqueci a senha" e Google ficam sob /api/auth.
 * A tela e a API dividem a mesma origem (nginx ou repasse da Vercel), então o endereço
 * público do Better Auth é o da tela.
 */
export const auth = betterAuth({
  appName: "Finn",
  baseURL: env.FRONTEND_ORIGIN,
  basePath: "/api/auth",
  secret: env.JWT_SECRET,
  trustedOrigins: [env.FRONTEND_ORIGIN],
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  // O limite de tentativas é o do Express (rate-limit.middleware.ts), que já sabe ler o IP.
  rateLimit: { enabled: false },
  session: { expiresIn: env.SESSION_DAYS * ONE_DAY, updateAge: ONE_DAY },
  advanced: {
    cookiePrefix: "finn",
    useSecureCookies: env.COOKIE_SECURE,
    // Explícito porque a biblioteca desliga essas conferências sozinha quando NODE_ENV=test.
    disableOriginCheck: false,
    disableCSRFCheck: false,
  },
  // Para o aplicativo futuro: o mesmo token de sessão pode ir em Authorization: Bearer.
  plugins: [bearer()],
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // Mantém o bcrypt que o Finn sempre usou: quem já tem conta entra sem trocar a senha.
    password: {
      hash: async (password) => {
        // O bcrypt ignora tudo depois do 72º byte, e acentos ocupam mais de um byte.
        if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) {
          throw new APIError("BAD_REQUEST", { message: "A senha deve ter no máximo 72 bytes." });
        }
        return bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
      },
      verify: async ({ hash, password }) => {
        if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) return false;
        return bcrypt.compare(password, hash);
      },
    },
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail(user.email, user.name, url);
    },
  },
  // Sem vínculo automático: quem criou a conta com senha não vira dono do e-mail de outra
  // pessoa no Google, e o inverso também não vale. Cada forma de entrar é uma conta.
  account: { accountLinking: { enabled: false } },
  socialProviders: googleEnabled
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID as string,
          clientSecret: env.GOOGLE_CLIENT_SECRET as string,
        },
      }
    : {},
  databaseHooks: {
    user: {
      create: {
        // Vale para o cadastro por senha e pelo Google.
        before: async (user) => {
          if (env.SIGNUP_ALLOWED_EMAILS && !env.SIGNUP_ALLOWED_EMAILS.includes(user.email)) {
            throw new APIError("FORBIDDEN", {
              message: "O cadastro está fechado para este e-mail.",
              code: "SIGNUP_CLOSED",
            });
          }
        },
      },
    },
  },
});
