import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "../lib/app-error";

export const ensureAuthenticated = (
  request: Request,
  _response: Response,
  next: NextFunction,
): void => {
  const authorization = request.headers.authorization;
  const [scheme, token] = authorization?.split(" ") ?? [];

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    next(new AppError("Token de autenticação ausente ou inválido.", 401));
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    const userId = typeof payload === "object" && typeof payload.sub === "string" ? payload.sub : undefined;

    if (!userId) {
      throw new AppError("Token de autenticação inválido.", 401);
    }

    request.userId = userId;
    next();
  } catch (error) {
    next(error instanceof AppError ? error : new AppError("Token de autenticação inválido ou expirado.", 401));
  }
};
