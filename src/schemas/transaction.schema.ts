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

export const createTransactionSchema = z
  .object({
    ...transactionFields,
    cardId: z.uuid().optional(),
    mode: z.enum(["SINGLE", "INSTALLMENTS", "RECURRING"]).default("SINGLE"),
    installments: z
      .object({
        count: z.number().int().min(2).max(48),
        valueMode: z.enum(["TOTAL", "PER_INSTALLMENT"]),
      })
      .optional(),
    recurrence: z.object({ endDate: calendarDateSchema.optional() }).optional(),
  })
  .superRefine((input, context) => {
    const issue = (path: string, message: string): void =>
      context.addIssue({ code: "custom", path: [path], message });

    if (input.cardId && input.paymentMethod !== "CREDIT_CARD") {
      issue("cardId", "cardId só é aceito quando a origem é cartão de crédito.");
    }

    if (input.mode === "INSTALLMENTS") {
      if (!input.installments) issue("installments", "Informe as parcelas.");
      if (input.paymentMethod !== "CREDIT_CARD" || input.type !== "EXPENSE") {
        issue("mode", "Só despesas no cartão de crédito podem ser parceladas.");
      }
    } else if (input.installments) {
      issue("installments", "installments só é aceito no modo INSTALLMENTS.");
    }

    if (input.recurrence) {
      if (input.mode !== "RECURRING") {
        issue("recurrence", "recurrence só é aceito no modo RECURRING.");
      } else if (input.recurrence.endDate && input.recurrence.endDate < input.date) {
        issue("recurrence", "A data final não pode ser anterior à data do lançamento.");
      }
    }
  });

export const updateTransactionSchema = z
  .object({
    categoryId: transactionFields.categoryId.optional(),
    type: transactionFields.type.optional(),
    description: transactionFields.description.optional(),
    date: transactionFields.date.optional(),
    paymentMethod: transactionFields.paymentMethod.optional(),
    value: transactionFields.value.optional(),
    cardId: z.uuid().optional(),
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
  cardId: z.uuid().optional(),
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
