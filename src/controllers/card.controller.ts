import type { Request, Response } from "express";
import { z } from "zod";
import { cardListSchema, createCardSchema, updateCardSchema } from "../schemas/card.schema";
import { CardService } from "../services/card.service";

export class CardController {
  constructor(private readonly cardService = new CardService()) {}

  list = async (request: Request, response: Response): Promise<void> => {
    const { includeInactive } = cardListSchema.parse(request.query);
    const cards = await this.cardService.list(request.userId!, includeInactive);
    response.status(200).json({ cards });
  };

  create = async (request: Request, response: Response): Promise<void> => {
    const card = await this.cardService.create(
      request.userId!,
      createCardSchema.parse(request.body),
    );
    response.status(201).json({ card });
  };

  update = async (request: Request, response: Response): Promise<void> => {
    const cardId = z.uuid().parse(request.params.id);
    const card = await this.cardService.update(
      request.userId!,
      cardId,
      updateCardSchema.parse(request.body),
    );
    response.status(200).json({ card });
  };

  setDefault = async (request: Request, response: Response): Promise<void> => {
    const cardId = z.uuid().parse(request.params.id);
    const card = await this.cardService.setDefault(request.userId!, cardId);
    response.status(200).json({ card });
  };

  deactivate = async (request: Request, response: Response): Promise<void> => {
    const cardId = z.uuid().parse(request.params.id);
    const result = await this.cardService.deactivate(request.userId!, cardId);
    response.status(200).json(result);
  };
}
