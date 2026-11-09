import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/app-error";
import { verifyAccessToken } from "../lib/jwt";

export const ensureAuthenticated = (
  request: Request,
  _response: Response,
  next: NextFunction,
): void => {
  const [scheme, token] = request.headers.authorization?.split(" ") ?? [];

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    next(new AppError("Token de autenticação ausente ou inválido.", 401));
    return;
  }

  try {
    const userId = verifyAccessToken(token);

    if (!userId) {
      next(new AppError("Token de autenticação inválido.", 401));
      return;
    }

    request.userId = userId;
    next();
  } catch {
    next(new AppError("Token de autenticação inválido ou expirado.", 401));
  }
};
