import type { Request, Response } from "express";
import { z } from "zod";
import { createGoalSchema, goalListSchema, updateGoalSchema } from "../schemas/goal.schema";
import { GoalService } from "../services/goal.service";

export class GoalController {
  constructor(private readonly goalService = new GoalService()) {}

  create = async (request: Request, response: Response): Promise<void> => {
    const goal = await this.goalService.create(
      request.userId!,
      createGoalSchema.parse(request.body),
    );
    response.status(201).json({ goal });
  };

  list = async (request: Request, response: Response): Promise<void> => {
    const result = await this.goalService.list(
      request.userId!,
      goalListSchema.parse(request.query),
    );
    response.status(200).json(result);
  };

  update = async (request: Request, response: Response): Promise<void> => {
    const goal = await this.goalService.update(
      request.userId!,
      z.uuid().parse(request.params.id),
      updateGoalSchema.parse(request.body),
    );
    response.status(200).json({ goal });
  };

  delete = async (request: Request, response: Response): Promise<void> => {
    await this.goalService.delete(request.userId!, z.uuid().parse(request.params.id));
    response.status(204).send();
  };
}
