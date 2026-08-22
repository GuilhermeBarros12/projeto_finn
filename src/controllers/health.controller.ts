import type { Request, Response } from "express";
import { HealthService } from "../services/health.service";

export class HealthController {
  constructor(private readonly healthService = new HealthService()) {}

  check = async (_request: Request, response: Response): Promise<void> => {
    const health = await this.healthService.check();
    response.status(200).json(health);
  };
}
