import type { Request, Response } from "express";
import { cardParamsSchema, invoiceParamsSchema } from "../schemas/invoice.schema";
import { InvoiceService } from "../services/invoice.service";

export class InvoiceController {
  constructor(private readonly invoiceService = new InvoiceService()) {}

  overview = async (request: Request, response: Response): Promise<void> => {
    const cards = await this.invoiceService.overview(request.userId!);
    response.status(200).json({ cards });
  };

  current = async (request: Request, response: Response): Promise<void> => {
    const { id } = cardParamsSchema.parse(request.params);
    const invoice = await this.invoiceService.current(request.userId!, id);
    response.status(200).json({ invoice });
  };

  byMonth = async (request: Request, response: Response): Promise<void> => {
    const { id, year, month } = invoiceParamsSchema.parse(request.params);
    const invoice = await this.invoiceService.invoice(request.userId!, id, { year, month });
    response.status(200).json({ invoice });
  };
}
