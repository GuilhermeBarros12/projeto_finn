import { z } from "zod";

export const cardParamsSchema = z.object({ id: z.uuid() });

export const invoiceParamsSchema = z.object({
  id: z.uuid(),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});
