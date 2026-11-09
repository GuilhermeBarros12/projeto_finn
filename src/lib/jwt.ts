import jwt from "jsonwebtoken";
import { env } from "../config/env";

const ALGORITHM = "HS256";

export const signAccessToken = (userId: string): string =>
  jwt.sign({}, env.JWT_SECRET, {
    algorithm: ALGORITHM,
    subject: userId,
    expiresIn: env.ACCESS_TOKEN_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });

export const verifyAccessToken = (token: string): string | undefined => {
  const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: [ALGORITHM] });
  return typeof payload === "object" && typeof payload.sub === "string" ? payload.sub : undefined;
};
