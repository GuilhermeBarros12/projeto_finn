import type { Request, Response } from "express";
import { exportFormatSchema } from "../schemas/export.schema";
import { transactionListSchema } from "../schemas/transaction.schema";
import { TransactionService } from "../services/transaction.service";

const csvValue = (value: unknown): string => {
  const text = String(value ?? "");
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
};
export class ExportController {
  constructor(private readonly transactions = new TransactionService()) {}
  transactionsExport = async (request: Request, response: Response): Promise<void> => {
    const { format } = exportFormatSchema.parse(request.query);
    const result = await this.transactions.list(request.userId!, transactionListSchema.parse(request.query));
    if (format === "json") { response.json(result); return; }
    const header = ["id", "categoryId", "type", "description", "date", "paymentMethod", "value", "createdAt"];
    const rows = result.data.map((t) => [t.id, t.categoryId, t.type, t.description, t.date.toISOString(), t.paymentMethod, t.value.toFixed(2), t.createdAt.toISOString()].map(csvValue).join(","));
    response.setHeader("Content-Type", "text/csv; charset=utf-8"); response.setHeader("Content-Disposition", `attachment; filename="transactions-page-${result.meta.page}.csv"`); response.send([header.join(","), ...rows].join("\n"));
  };
}
