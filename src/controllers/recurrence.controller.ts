import type { Request, Response } from "express";
import { z } from "zod";
import { RecurrenceService } from "../services/recurrence.service";

export class RecurrenceController {
  constructor(private readonly recurrenceService = new RecurrenceService()) {}

  ending = async (request: Request, response: Response): Promise<void> => {
    const recurrences = await this.recurrenceService.ending(request.userId!);
    response.status(200).json({ recurrences });
  };

  renew = async (request: Request, response: Response): Promise<void> => {
    const transactions = await this.recurrenceService.renew(
      request.userId!,
      z.uuid().parse(request.params.id),
    );
    response.status(201).json({ transactions });
  };

  finish = async (request: Request, response: Response): Promise<void> => {
    const recurrence = await this.recurrenceService.finish(
      request.userId!,
      z.uuid().parse(request.params.id),
    );
    response.status(200).json({ recurrence });
  };
}
