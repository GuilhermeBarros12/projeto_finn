import bcrypt from "bcryptjs";
import { AppError } from "../lib/app-error";
import { signAccessToken } from "../lib/jwt";
import { prisma } from "../lib/prisma";
import type { LoginInput } from "../schemas/auth.schema";
import { toPublicUser, type PublicUser } from "./user.service";

export interface LoginResponse {
  token: string;
  user: PublicUser;
}

export class AuthService {
  async login({ email, password }: LoginInput): Promise<LoginResponse> {
    const user = await prisma.user.findUnique({ where: { email } });
    const passwordMatches = user ? await bcrypt.compare(password, user.password) : false;

    if (!user || !passwordMatches) {
      throw new AppError("E-mail ou senha inválidos.", 401);
    }

    return { token: signAccessToken(user.id), user: toPublicUser(user) };
  }
}
