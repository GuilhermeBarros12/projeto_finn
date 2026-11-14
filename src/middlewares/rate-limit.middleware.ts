import { rateLimit, type Options } from "express-rate-limit";
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
export const refreshLimiter = createLimiter(FIFTEEN_MINUTES, env.LOGIN_RATE_LIMIT_MAX * 10);

/** Por pessoa, não por IP: cada pergunta tem custo na API da Anthropic. */
export const agentLimiter = createLimiter(ONE_HOUR, env.AGENT_RATE_LIMIT_MAX, {
  keyGenerator: (request) => request.userId ?? "sem-usuario",
});
