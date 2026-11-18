import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/app-error";

/**
 * O Better Auth lê o corpo por conta própria, fora do express.json (e do limite dele).
 * Este limite equivale ao de 100 kb do resto da API. Só olha o Content-Length declarado:
 * ouvir o fluxo aqui o consumiria antes do Better Auth. Um corpo em pedaços sem tamanho
 * ainda é barrado pelo teto de 32 MB do Cloud Run e de 4,5 MB da Vercel.
 */
export const bodyLimit =
  (maxBytes: number) =>
  (request: Request, _response: Response, next: NextFunction): void => {
    const declared = Number(request.headers["content-length"] ?? 0);

    if (declared > maxBytes) {
      next(new AppError("Corpo da requisição grande demais.", 413));
      return;
    }

    next();
  };
