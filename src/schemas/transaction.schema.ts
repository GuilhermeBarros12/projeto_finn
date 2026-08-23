import { z } from "zod";

const transactionFields = {
  categoryId: z.uuid(),
  type: z.enum(["INCOME", "EXPENSE"]),
  description: z.string().trim().min(1).max(255),
  date: z.coerce.date(),
  paymentMethod: z.enum(["PIX", "CREDIT_CARD", "DEBIT_CARD", "CASH", "BANK_TRANSFER", "OTHER"]),
  value: z.coerce.number().finite().positive("O valor deve ser maior que zero."),
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

export const transactionListSchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    date: z.iso.date().optional(),
    month: z.coerce.number().int().min(1).max(12).optional(),
    year: z.coerce.number().int().min(2000).max(2100).optional(),
    categoryId: z.uuid().optional(),
    paymentMethod: transactionFields.paymentMethod.optional(),
    origin: z.enum(["ACCOUNT", "CREDIT_CARD"]).optional(),
  })
  .superRefine((input, context) => {
    if (input.month !== undefined && input.year === undefined) {
      context.addIssue({ code: "custom", path: ["year"], message: "year é obrigatório quando month for informado." });
    }

    if (input.date && (input.month !== undefined || input.year !== undefined)) {
      context.addIssue({ code: "custom", path: ["date"], message: "Use date ou month/year, não ambos." });
    }

    if (input.origin && input.paymentMethod) {
      context.addIssue({ code: "custom", path: ["origin"], message: "Use origin ou paymentMethod, não ambos." });
    }
  });

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type TransactionListInput = z.infer<typeof transactionListSchema>;
