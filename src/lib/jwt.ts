import jwt from "jsonwebtoken";
import { env } from "../config/env";

export const signAccessToken = (userId: string): string =>
  jwt.sign({}, env.JWT_SECRET, {
    subject: userId,
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
