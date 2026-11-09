import { once } from "node:events";
import type { Request, Response } from "express";
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

const write = async (response: Response, chunk: string): Promise<void> => {
  if (!response.write(chunk)) await once(response, "drain");
};

export class ExportController {
  constructor(private readonly transactionService = new TransactionService()) {}

  transactions = async (request: Request, response: Response): Promise<void> => {
    const { format } = exportFormatSchema.parse(request.query);
    const filters = transactionFilterSchema.parse(request.query);
    const rows = this.transactionService.iterate(request.userId!, filters);

    if (format === "csv") {
      response.setHeader("Content-Type", "text/csv; charset=utf-8");
      response.setHeader("Content-Disposition", 'attachment; filename="transacoes.csv"');
      await write(response, `${UTF8_BOM}${CSV_HEADER.join(",")}\n`);
      for await (const transaction of rows) await write(response, `${toCsvRow(transaction)}\n`);
      response.end();
      return;
    }

    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader("Content-Disposition", 'attachment; filename="transacoes.json"');
    await write(response, '{"data":[');

    let total = 0;
    for await (const transaction of rows) {
      await write(response, `${total > 0 ? "," : ""}${JSON.stringify(transaction)}`);
      total += 1;
    }

    response.end(`],"meta":{"total":${total}}}`);
  };
}
