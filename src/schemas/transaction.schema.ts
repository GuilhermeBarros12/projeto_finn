import { z } from "zod";
import { calendarDateSchema, moneySchema, paginationFields } from "./common.schema";

const transactionFields = {
  categoryId: z.uuid(),
  type: z.enum(["INCOME", "EXPENSE"]),
  description: z.string().trim().min(1).max(255),
  date: calendarDateSchema,
  paymentMethod: z.enum(["PIX", "CREDIT_CARD", "DEBIT_CARD", "CASH", "BANK_TRANSFER", "OTHER"]),
  value: moneySchema,
};

export const createTransactionSchema = z.object(transactionFields);

export const updateTransactionSchema = z
  .object({
    categoryId: transactionFields.categoryId.optional(),
    type: transactionFields.type.optional(),
    description: transactionFields.description.optional(),
    date: transactionFields.date.optional(),
    paymentMethod: transactionFields.paymentMethod.optional(),
    value: transactionFields.value.optional(),
  })
  .refine((input) => Object.values(input).some((value) => value !== undefined), {
    message: "Informe ao menos um campo para atualização.",
  });

const filterFields = {
  date: z.iso.date().optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  categoryId: z.uuid().optional(),
  type: transactionFields.type.optional(),
  paymentMethod: transactionFields.paymentMethod.optional(),
  origin: z.enum(["ACCOUNT", "CREDIT_CARD"]).optional(),
};

interface FilterInput {
  date?: string | undefined;
  month?: number | undefined;
  year?: number | undefined;
  origin?: string | undefined;
  paymentMethod?: string | undefined;
}

const coherentFilters = (input: FilterInput, context: z.RefinementCtx): void => {
  if (input.month !== undefined && input.year === undefined) {
    context.addIssue({
      code: "custom",
      path: ["year"],
      message: "year é obrigatório quando month for informado.",
    });
  }

  if (input.date && (input.month !== undefined || input.year !== undefined)) {
    context.addIssue({
      code: "custom",
      path: ["date"],
      message: "Use date ou month/year, não ambos.",
    });
  }

  if (input.origin && input.paymentMethod) {
    context.addIssue({
      code: "custom",
      path: ["origin"],
      message: "Use origin ou paymentMethod, não ambos.",
    });
  }
};

export const transactionFilterSchema = z.object(filterFields).superRefine(coherentFilters);
export const transactionListSchema = z
  .object({ ...filterFields, ...paginationFields })
  .superRefine(coherentFilters);

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type TransactionFilterInput = z.infer<typeof transactionFilterSchema>;
export type TransactionListInput = z.infer<typeof transactionListSchema>;
