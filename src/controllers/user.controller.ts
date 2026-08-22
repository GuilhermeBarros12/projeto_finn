import type { Request, Response } from "express";
import { createUserSchema } from "../schemas/auth.schema";
import { UserService } from "../services/user.service";

export class UserController {
  constructor(private readonly userService = new UserService()) {}

  create = async (request: Request, response: Response): Promise<void> => {
    const input = createUserSchema.parse(request.body);
    const user = await this.userService.create(input);

    response.status(201).json({ user });
  };
}
