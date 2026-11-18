import pino from "pino";
import { pinoHttp } from "pino-http";
import { env } from "../config/env";

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      'res.headers["set-cookie"]',
      // O token de sessão que o Better Auth devolve para o aplicativo.
      'res.headers["set-auth-token"]',
      // O redirecionamento do link de redefinição leva o token na URL de destino.
      "res.headers.location",
      // Retorno do login com o Google.
      "req.query.code",
      "req.query.state",
      "password",
      "token",
    ],
    censor: "[redacted]",
  },
});

/** O link de redefinição e o retorno do Google levam segredos na URL; o log não pode guardá-los. */
export const maskSecretsInUrl = (url: string | undefined): string | undefined =>
  url
    ?.replace(/(\/reset-password\/)[^/?#]+/, "$1[redacted]")
    .replace(/([?&](?:code|state|token)=)[^&#]+/g, "$1[redacted]");

export const httpLogger = pinoHttp({
  logger,
  serializers: {
    req: (request: { url?: string }) => ({
      ...pino.stdSerializers.req(request as never),
      url: maskSecretsInUrl(request.url),
    }),
  },
  autoLogging: { ignore: (request) => request.url === "/api/health" },
  customLogLevel: (_request, response, error) => {
    if (error || response.statusCode >= 500) return "error";
    return response.statusCode >= 400 ? "warn" : "info";
  },
});
