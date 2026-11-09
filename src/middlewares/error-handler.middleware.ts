import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../lib/app-error";

interface HttpLikeError {
  code?: unknown;
  status?: unknown;
  type?: unknown;
}

const asHttpLike = (error: unknown): HttpLikeError =>
  typeof error === "object" && error !== null ? error : {};

export const notFoundHandler: RequestHandler = (request, _response, next) => {
  next(new AppError(`Rota ${request.method} ${request.originalUrl} não encontrada.`, 404));
};

export const errorHandler: ErrorRequestHandler = (error, request, response, next) => {
  if (response.headersSent) {
    request.log.error({ err: error }, "Falha depois do início da resposta");
    next(error);
    return;
  }

  if (error instanceof ZodError) {
    response.status(400).json({
      message: "Dados de entrada inválidos.",
      issues: error.issues.map(({ path, message }) => ({ field: path.join("."), message })),
    });
    return;
  }

  if (error instanceof AppError) {
    if (error.statusCode >= 500) request.log.error({ err: error }, error.message);
    response.status(error.statusCode).json({ message: error.message });
    return;
  }

  const { code, status, type } = asHttpLike(error);

  if (code === "P2002") {
    response.status(409).json({ message: "Já existe um registro com este valor único." });
    return;
  }

  if (type === "entity.parse.failed") {
    response.status(400).json({ message: "O corpo da requisição não é um JSON válido." });
    return;
  }

  if (type === "entity.too.large") {
    response.status(413).json({ message: "O corpo da requisição é grande demais." });
    return;
  }

  if (typeof status === "number" && status >= 400 && status < 500) {
    response.status(status).json({ message: "Requisição inválida." });
    return;
  }

  request.log.error({ err: error }, "Erro não tratado");
  response.status(500).json({ message: "Erro interno do servidor." });
};
