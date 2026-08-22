import bcrypt from "bcryptjs";
import type { User } from "../../generated/prisma/client";
import { AppError } from "../lib/app-error";
import { prisma } from "../lib/prisma";
import type { CreateUserInput } from "../schemas/auth.schema";

const PASSWORD_SALT_ROUNDS = 12;

export type PublicUser = Pick<User, "id" | "name" | "email" | "createdAt" | "updatedAt">;

export const toPublicUser = (user: User): PublicUser => ({
  id: user.id,
  name: user.name,
  email: user.email,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export class UserService {
  async create({ name, email, password }: CreateUserInput): Promise<PublicUser> {
    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      throw new AppError("Já existe uma conta cadastrada com este e-mail.", 409);
    }

    const passwordHash = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
    const user = await prisma.user.create({
      data: { name, email, password: passwordHash },
    });

    return toPublicUser(user);
  }
}
