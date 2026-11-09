import type { Request, Response } from "express";
import { dashboardPeriodSchema } from "../schemas/dashboard.schema";
import { DashboardService } from "../services/dashboard.service";

export class DashboardController {
  constructor(private readonly dashboardService = new DashboardService()) {}

  summary = async (request: Request, response: Response): Promise<void> => {
    const summary = await this.dashboardService.summary(
      request.userId!,
      dashboardPeriodSchema.parse(request.query),
    );
    response.status(200).json(summary);
  };

  byCategory = async (request: Request, response: Response): Promise<void> => {
    const categories = await this.dashboardService.totalsByCategory(
      request.userId!,
      dashboardPeriodSchema.parse(request.query),
    );
    response.status(200).json({ categories });
  };

  byOrigin = async (request: Request, response: Response): Promise<void> => {
    const totals = await this.dashboardService.totalsByOrigin(
      request.userId!,
      dashboardPeriodSchema.parse(request.query),
    );
    response.status(200).json(totals);
  };
}
