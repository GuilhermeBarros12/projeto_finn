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
      "password",
      "token",
    ],
    censor: "[redacted]",
  },
});

export const httpLogger = pinoHttp({
  logger,
  autoLogging: { ignore: (request) => request.url === "/api/health" },
  customLogLevel: (_request, response, error) => {
    if (error || response.statusCode >= 500) return "error";
    return response.statusCode >= 400 ? "warn" : "info";
  },
});
