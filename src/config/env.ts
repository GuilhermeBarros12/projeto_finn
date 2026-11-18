import "dotenv/config";
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

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3333),
  DATABASE_URL: z.url(
    "Defina DATABASE_URL, ou POSTGRES_HOST, POSTGRES_USER, POSTGRES_PASSWORD e POSTGRES_DB.",
  ),
  // Assina e cifra os dados do Better Auth. O nome é antigo, do tempo do JWT próprio.
  JWT_SECRET: z.string().min(32, "JWT_SECRET deve ter pelo menos 32 caracteres."),
  SESSION_DAYS: z.coerce.number().int().positive().default(30),
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
  // Login com Google: o botão só aparece quando as duas variáveis existem.
  GOOGLE_CLIENT_ID: z
    .string()
    .optional()
    .transform((value) => value || undefined),
  GOOGLE_CLIENT_SECRET: z
    .string()
    .optional()
    .transform((value) => value || undefined),
  // E-mails de redefinição de senha. Sem a chave, o link só aparece no log (fora da produção).
  RESEND_API_KEY: z
    .string()
    .optional()
    .transform((value) => value || undefined),
  EMAIL_FROM: z.string().min(3).default("Finn <onboarding@resend.dev>"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).optional(),
});

const parsed = envSchema.parse({ ...process.env, DATABASE_URL: resolveDatabaseUrl(process.env) });

/** Variáveis antigas que ainda aparecem no .env e não fazem mais efeito, com a substituta. */
export const ignoredVariables = Object.entries({
  JWT_EXPIRES_IN: "SESSION_DAYS",
  ACCESS_TOKEN_EXPIRES_IN: "SESSION_DAYS",
  REFRESH_TOKEN_DAYS: "SESSION_DAYS",
}).filter(([name]) => process.env[name] !== undefined);

export const env = {
  ...parsed,
  COOKIE_SECURE: parsed.COOKIE_SECURE
    ? parsed.COOKIE_SECURE === "true"
    : parsed.NODE_ENV === "production",
  LOG_LEVEL: parsed.LOG_LEVEL ?? (parsed.NODE_ENV === "test" ? "silent" : "info"),
};
