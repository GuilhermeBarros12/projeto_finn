import { z } from "zod";

const DIAS_IGUAIS = "O dia de fechamento e o de vencimento precisam ser diferentes.";

const nameSchema = z.string().trim().min(1).max(60);
const dayOfMonthSchema = z.number().int().min(1).max(31);

export const createCardSchema = z
  .object({
    name: nameSchema,
    closingDay: dayOfMonthSchema,
    dueDay: dayOfMonthSchema,
    isDefault: z.boolean().optional(),
  })
  .refine((card) => card.closingDay !== card.dueDay, {
    message: DIAS_IGUAIS,
    path: ["dueDay"],
  });

export const updateCardSchema = z
  .object({
    name: nameSchema.optional(),
    closingDay: dayOfMonthSchema.optional(),
    dueDay: dayOfMonthSchema.optional(),
  })
  .refine((card) => Object.values(card).some((value) => value !== undefined), {
    message: "Informe ao menos um campo para atualizar.",
  })
  .refine(
    (card) =>
      card.closingDay === undefined || card.dueDay === undefined || card.closingDay !== card.dueDay,
    { message: DIAS_IGUAIS, path: ["dueDay"] },
  );

export const cardListSchema = z.object({
  includeInactive: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

export type CreateCardInput = z.infer<typeof createCardSchema>;
export type UpdateCardInput = z.infer<typeof updateCardSchema>;
