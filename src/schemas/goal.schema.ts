import { z } from "zod";
import { calendarDateSchema, moneySchema, paginationFields } from "./common.schema";

const fields = {
  title: z.string().trim().min(1).max(120),
  type: z.enum(["SAVINGS", "SPENDING_LIMIT"]),
  targetValue: moneySchema,
  dueDate: calendarDateSchema,
  status: z.enum(["IN_PROGRESS", "COMPLETED", "EXPIRED"]),
  categoryId: z.uuid().nullable(),
};

const coherent = (input: { type: string; categoryId: string | null }, context: z.RefinementCtx) => {
  if (input.type === "SAVINGS" && input.categoryId !== null) {
    context.addIssue({
      code: "custom",
      path: ["categoryId"],
      message: "Meta de economia não aceita categoria.",
    });
  }

  if (input.type === "SPENDING_LIMIT" && input.categoryId === null) {
    context.addIssue({
      code: "custom",
      path: ["categoryId"],
      message: "Limite de gasto exige categoria.",
    });
  }
};

export const createGoalSchema = z
  .object({ ...fields, status: fields.status.default("IN_PROGRESS") })
  .superRefine(coherent);
export const updateGoalSchema = z.object(fields).superRefine(coherent);
export const goalListSchema = z.object({ ...paginationFields, status: fields.status.optional() });

export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
export type GoalListInput = z.infer<typeof goalListSchema>;
