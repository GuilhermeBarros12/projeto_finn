import type { Request, Response } from "express";
import { ClientDisconnectedError, createStreamWriter } from "../lib/stream-writer";
import { exportFormatSchema } from "../schemas/export.schema";
import { transactionFilterSchema } from "../schemas/transaction.schema";
import { TransactionService, type TransactionWithCategory } from "../services/transaction.service";

const CSV_HEADER = [
  "id",
  "categoryId",
  "categoryName",
  "type",
  "description",
  "date",
  "paymentMethod",
  "value",
  "createdAt",
];
const UTF8_BOM = "﻿";

/** Neutraliza fórmulas: planilhas executam células iniciadas por estes caracteres. */
export const csvValue = (value: unknown): string => {
  const text = String(value ?? "");
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
};

const toCsvRow = (transaction: TransactionWithCategory): string =>
  [
    transaction.id,
    transaction.categoryId,
    transaction.category.name,
    transaction.type,
    transaction.description,
    transaction.date.toISOString(),
    transaction.paymentMethod,
    transaction.value.toFixed(2),
    transaction.createdAt.toISOString(),
  ]
    .map(csvValue)
    .join(",");

export class ExportController {
  constructor(private readonly transactionService = new TransactionService()) {}

  transactions = async (request: Request, response: Response): Promise<void> => {
    const { format } = exportFormatSchema.parse(request.query);
    const filters = transactionFilterSchema.parse(request.query);
    const rows = this.transactionService.iterate(request.userId!, filters);
    const write = createStreamWriter(response);

    try {
      if (format === "csv") {
        response.setHeader("Content-Type", "text/csv; charset=utf-8");
        response.setHeader("Content-Disposition", 'attachment; filename="transacoes.csv"');
        await write(`${UTF8_BOM}${CSV_HEADER.join(",")}\n`);
        for await (const transaction of rows) await write(`${toCsvRow(transaction)}\n`);
        response.end();
        return;
      }

      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.setHeader("Content-Disposition", 'attachment; filename="transacoes.json"');
      await write('{"data":[');

      let total = 0;
      for await (const transaction of rows) {
        await write(`${total > 0 ? "," : ""}${JSON.stringify(transaction)}`);
        total += 1;
      }

      response.end(`],"meta":{"total":${total}}}`);
    } catch (error) {
      // Download cancelado: sair do laço já interrompe as consultas; não é erro do servidor.
      if (error instanceof ClientDisconnectedError) {
        request.log.info("Exportação interrompida pelo cliente");
        return;
      }

      throw error;
    }
  };
}
