import { fromNodeHeaders } from "better-auth/node";
import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/app-error";
import { auth } from "../lib/auth";

/** Aceita o cookie de sessão da tela e, para o aplicativo, o mesmo token em Authorization. */
export const ensureAuthenticated = async (
  request: Request,
  _response: Response,
  next: NextFunction,
): Promise<void> => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });

  if (!session) {
    next(new AppError("Sessão inválida ou expirada.", 401));
    return;
  }

  request.userId = session.user.id;
  next();
};
