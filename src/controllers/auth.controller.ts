import type { Request, Response } from "express";
import { loginSchema } from "../schemas/auth.schema";
import { AuthService } from "../services/auth.service";

export class AuthController {
  constructor(private readonly authService = new AuthService()) {}

  login = async (request: Request, response: Response): Promise<void> => {
    const input = loginSchema.parse(request.body);
    const result = await this.authService.login(input);

    response.status(200).json(result);
  };
}
