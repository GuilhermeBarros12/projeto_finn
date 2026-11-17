import type { Request, Response } from "express";
import { z } from "zod";
import {
  createTransactionSchema,
  transactionListSchema,
  transactionScopeSchema,
  updateTransactionSchema,
} from "../schemas/transaction.schema";
import { TransactionService } from "../services/transaction.service";

export class TransactionController {
  constructor(private readonly transactionService = new TransactionService()) {}

  create = async (request: Request, response: Response): Promise<void> => {
    const transactions = await this.transactionService.create(
      request.userId!,
      createTransactionSchema.parse(request.body),
    );
    response.status(201).json({ transaction: transactions[0], transactions });
  };

  list = async (request: Request, response: Response): Promise<void> => {
    const result = await this.transactionService.list(
      request.userId!,
      transactionListSchema.parse(request.query),
    );
    response.status(200).json(result);
  };

  update = async (request: Request, response: Response): Promise<void> => {
    const { scope } = transactionScopeSchema.parse(request.query);
    const result = await this.transactionService.update(
      request.userId!,
      z.uuid().parse(request.params.id),
      updateTransactionSchema.parse(request.body),
      scope,
    );
    response.status(200).json(result);
  };

  delete = async (request: Request, response: Response): Promise<void> => {
    const { scope } = transactionScopeSchema.parse(request.query);
    await this.transactionService.delete(request.userId!, z.uuid().parse(request.params.id), scope);
    response.status(204).send();
  };
}
