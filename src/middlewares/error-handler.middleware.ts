import type { ErrorRequestHandler, RequestHandler } from "express";
import { AppError } from "../lib/app-error";

export const notFoundHandler: RequestHandler = (request, _response, next) => {
  next(new AppError(`Rota ${request.method} ${request.originalUrl} não encontrada.`, 404));
};

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  const statusCode = error instanceof AppError ? error.statusCode : 500;
  const message = error instanceof AppError ? error.message : "Erro interno do servidor.";

  response.status(statusCode).json({ message });
};
