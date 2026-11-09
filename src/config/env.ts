import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3333),
  DATABASE_URL: z.url(),
  JWT_SECRET: z.string().min(32, "JWT_SECRET deve ter pelo menos 32 caracteres."),
  ACCESS_TOKEN_EXPIRES_IN: z.string().default("15m"),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().positive().default(30),
  COOKIE_SECURE: z.enum(["true", "false"]).optional(),
  FRONTEND_ORIGIN: z.url().default("http://localhost:5173"),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  APP_TIMEZONE: z.string().default("America/Sao_Paulo"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).optional(),
});

const parsed = envSchema.parse(process.env);

export const env = {
  ...parsed,
  COOKIE_SECURE: parsed.COOKIE_SECURE
    ? parsed.COOKIE_SECURE === "true"
    : parsed.NODE_ENV === "production",
  LOG_LEVEL: parsed.LOG_LEVEL ?? (parsed.NODE_ENV === "test" ? "silent" : "info"),
};
