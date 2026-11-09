import type { CookieOptions, Response } from "express";
import { env } from "../config/env";

export const REFRESH_COOKIE = "finn_refresh";

const baseOptions: CookieOptions = {
  httpOnly: true,
  sameSite: "strict",
  secure: env.COOKIE_SECURE,
  path: "/api/auth",
};

export const setRefreshCookie = (response: Response, token: string, expiresAt: Date): void => {
  response.cookie(REFRESH_COOKIE, token, { ...baseOptions, expires: expiresAt });
};

export const clearRefreshCookie = (response: Response): void => {
  response.clearCookie(REFRESH_COOKIE, baseOptions);
};
