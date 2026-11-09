import { z } from "zod";

/** Maior valor que cabe em Decimal(15,2). Sem o teto, o excesso viraria erro 500 no banco. */
const MAX_MONEY = 9_999_999_999_999.99;

export const moneySchema = z.coerce
  .number()
  .finite()
  .min(0.01, "O valor deve ser maior que zero.")
  .max(MAX_MONEY, "O valor excede o limite permitido.");

export const paginationFields = {
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
};
