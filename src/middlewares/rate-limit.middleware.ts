import { ipKeyGenerator, rateLimit, type Options } from "express-rate-limit";
import { env } from "../config/env";
import { AppError } from "../lib/app-error";

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

const createLimiter = (windowMs: number, limit: number, options: Partial<Options> = {}) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_request, _response, next) => {
      next(new AppError("Muitas tentativas. Aguarde alguns minutos e tente novamente.", 429));
    },
    ...options,
  });

/** Conta apenas falhas: quem acerta a senha não consome a cota. */
export const loginLimiter = createLimiter(FIFTEEN_MINUTES, env.LOGIN_RATE_LIMIT_MAX, {
  skipSuccessfulRequests: true,
});
export const signupLimiter = createLimiter(ONE_HOUR, env.LOGIN_RATE_LIMIT_MAX * 2);
/**
 * Cada pedido de redefinição dispara um e-mail. O limite é por endereço, para ninguém encher a
 * caixa de outra pessoa: por IP não serviria, porque atrás da Vercel todo mundo tem o mesmo.
 */
export const passwordResetLimiter = createLimiter(ONE_HOUR, env.LOGIN_RATE_LIMIT_MAX, {
  keyGenerator: (request) => {
    const body: unknown = request.body;
    const email =
      typeof body === "object" && body !== null && "email" in body && typeof body.email === "string"
        ? body.email.trim().toLowerCase().slice(0, 254)
        : "";
    return email ? `email:${email}` : ipKeyGenerator(request.ip ?? "sem-ip");
  },
});
/** Teto geral dos pedidos e das trocas de senha, contra quem varre muitos endereços. */
export const passwordResetIpLimiter = createLimiter(ONE_HOUR, env.LOGIN_RATE_LIMIT_MAX * 3);

/** Por pessoa, não por IP: cada pergunta tem custo na API da Anthropic. */
export const agentLimiter = createLimiter(ONE_HOUR, env.AGENT_RATE_LIMIT_MAX, {
  keyGenerator: (request) => request.userId ?? "sem-usuario",
});
