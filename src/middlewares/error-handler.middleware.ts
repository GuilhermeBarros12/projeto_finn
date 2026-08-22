import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../lib/app-error";

export const notFoundHandler: RequestHandler = (request, _response, next) => {
  next(new AppError(`Rota ${request.method} ${request.originalUrl} não encontrada.`, 404));
};

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof ZodError) {
    response.status(400).json({
      message: "Dados de entrada inválidos.",
      issues: error.issues.map(({ path, message }) => ({ field: path.join("."), message })),
    });
    return;
  }

  const errorCode =
    typeof error === "object" && error !== null && "code" in error ? error.code : undefined;

  if (errorCode === "P2002") {
    response.status(409).json({ message: "Já existe um registro com este valor único." });
    return;
  }

  const statusCode = error instanceof AppError ? error.statusCode : 500;
  const message = error instanceof AppError ? error.message : "Erro interno do servidor.";

  response.status(statusCode).json({ message });
};
