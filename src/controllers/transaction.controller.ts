import type { Request, Response } from "express";
import { z } from "zod";
import {
  createTransactionSchema,
  transactionListSchema,
  updateTransactionSchema,
} from "../schemas/transaction.schema";
import { TransactionService } from "../services/transaction.service";

export class TransactionController {
  constructor(private readonly transactionService = new TransactionService()) {}

  create = async (request: Request, response: Response): Promise<void> => {
    const transaction = await this.transactionService.create(request.userId!, createTransactionSchema.parse(request.body));
    response.status(201).json({ transaction });
  };

  list = async (request: Request, response: Response): Promise<void> => {
    const result = await this.transactionService.list(request.userId!, transactionListSchema.parse(request.query));
    response.status(200).json(result);
  };

  update = async (request: Request, response: Response): Promise<void> => {
    const transaction = await this.transactionService.update(
      request.userId!,
      z.uuid().parse(request.params.id),
      updateTransactionSchema.parse(request.body),
    );
    response.status(200).json({ transaction });
  };

  delete = async (request: Request, response: Response): Promise<void> => {
    await this.transactionService.delete(request.userId!, z.uuid().parse(request.params.id));
    response.status(204).send();
  };
}
