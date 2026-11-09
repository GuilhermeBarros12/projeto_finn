import { rateLimit } from "express-rate-limit";
import { env } from "../config/env";
import { AppError } from "../lib/app-error";

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

const createLimiter = (windowMs: number, limit: number, skipSuccessfulRequests = false) =>
  rateLimit({
    windowMs,
    limit,
    skipSuccessfulRequests,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_request, _response, next) => {
      next(new AppError("Muitas tentativas. Aguarde alguns minutos e tente novamente.", 429));
    },
  });

/** Conta apenas falhas: quem acerta a senha não consome a cota. */
export const loginLimiter = createLimiter(FIFTEEN_MINUTES, env.LOGIN_RATE_LIMIT_MAX, true);
export const signupLimiter = createLimiter(ONE_HOUR, env.LOGIN_RATE_LIMIT_MAX * 2);
export const refreshLimiter = createLimiter(FIFTEEN_MINUTES, env.LOGIN_RATE_LIMIT_MAX * 10);
