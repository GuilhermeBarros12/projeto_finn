import "dotenv/config";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { resolveDatabaseUrl } from "./database-url";

const isValidTimeZone = (timeZone: string): boolean => {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone });
    return true;
  } catch {
    return false;
  }
};

// Assina um token de prova: "900" sem unidade vira 900 ms, e o login quebraria só na hora.
const lastsAtLeastOneMinute = (expiresIn: string): boolean => {
  try {
    const token = jwt.sign({}, "validacao-da-configuracao", {
      expiresIn: expiresIn as jwt.SignOptions["expiresIn"],
    });
    const { iat, exp } = jwt.decode(token) as { iat: number; exp: number };
    return exp - iat >= 60;
  } catch {
    return false;
  }
};

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3333),
  DATABASE_URL: z.url(
    "Defina DATABASE_URL, ou POSTGRES_HOST, POSTGRES_USER, POSTGRES_PASSWORD e POSTGRES_DB.",
  ),
  JWT_SECRET: z.string().min(32, "JWT_SECRET deve ter pelo menos 32 caracteres."),
  ACCESS_TOKEN_EXPIRES_IN: z
    .string()
    .default("15m")
    .refine(
      lastsAtLeastOneMinute,
      "ACCESS_TOKEN_EXPIRES_IN deve ser uma duração de pelo menos 1 minuto, como 15m.",
    ),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().positive().default(30),
  COOKIE_SECURE: z.enum(["true", "false"]).optional(),
  FRONTEND_ORIGIN: z.url().default("http://localhost:5173"),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  APP_TIMEZONE: z
    .string()
    .default("America/Sao_Paulo")
    .refine(isValidTimeZone, "APP_TIMEZONE deve ser um fuso como America/Sao_Paulo."),
  // Opcional: sem a chave, só o assistente fica indisponível.
  ANTHROPIC_API_KEY: z
    .string()
    .optional()
    .transform((value) => value || undefined),
  ANTHROPIC_MODEL: z.string().min(1).default("claude-opus-5-5"),
  AGENT_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),
  // Vazia, o cadastro fica aberto; com e-mails separados por vírgula, só eles podem criar conta.
  SIGNUP_ALLOWED_EMAILS: z
    .string()
    .optional()
    .transform((value) => {
      const emails = (value ?? "")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);
      return emails.length > 0 ? emails : undefined;
    }),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).optional(),
});

const parsed = envSchema.parse({ ...process.env, DATABASE_URL: resolveDatabaseUrl(process.env) });

/** Variáveis antigas que ainda aparecem no .env e não fazem mais efeito, com a substituta. */
export const ignoredVariables = Object.entries({
  JWT_EXPIRES_IN: "ACCESS_TOKEN_EXPIRES_IN",
}).filter(([name]) => process.env[name] !== undefined);

export const env = {
  ...parsed,
  COOKIE_SECURE: parsed.COOKIE_SECURE
    ? parsed.COOKIE_SECURE === "true"
    : parsed.NODE_ENV === "production",
  LOG_LEVEL: parsed.LOG_LEVEL ?? (parsed.NODE_ENV === "test" ? "silent" : "info"),
};
