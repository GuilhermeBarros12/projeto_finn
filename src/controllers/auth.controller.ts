import type { Request, Response } from "express";
import { clearRefreshCookie, REFRESH_COOKIE, setRefreshCookie } from "../lib/refresh-cookie";
import { loginSchema } from "../schemas/auth.schema";
import { AuthService, type Session } from "../services/auth.service";

const readRefreshToken = (request: Request): string | undefined => {
  const token: unknown = request.cookies?.[REFRESH_COOKIE];
  return typeof token === "string" ? token : undefined;
};

const respondWithSession = (response: Response, session: Session): void => {
  setRefreshCookie(response, session.refreshToken, session.refreshExpiresAt);
  response.status(200).json({ token: session.token, user: session.user });
};

export class AuthController {
  constructor(private readonly authService = new AuthService()) {}

  login = async (request: Request, response: Response): Promise<void> => {
    const input = loginSchema.parse(request.body);
    respondWithSession(response, await this.authService.login(input));
  };

  refresh = async (request: Request, response: Response): Promise<void> => {
    try {
      respondWithSession(response, await this.authService.refresh(readRefreshToken(request)));
    } catch (error) {
      clearRefreshCookie(response);
      throw error;
    }
  };

  logout = async (request: Request, response: Response): Promise<void> => {
    await this.authService.logout(readRefreshToken(request));
    clearRefreshCookie(response);
    response.status(204).send();
  };
}
