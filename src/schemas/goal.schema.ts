import { z } from "zod";

const fields = {
  title: z.string().trim().min(1).max(120),
  type: z.enum(["SAVINGS", "SPENDING_LIMIT"]),
  targetValue: z.coerce.number().finite().positive(),
  dueDate: z.coerce.date(),
  status: z.enum(["IN_PROGRESS", "COMPLETED", "EXPIRED"]),
  categoryId: z.uuid().nullable(),
};

const coherent = (input: { type: string; categoryId: string | null }, ctx: z.RefinementCtx) => {
  if (input.type === "SAVINGS" && input.categoryId !== null) ctx.addIssue({ code: "custom", path: ["categoryId"], message: "Meta de economia não aceita categoria." });
  if (input.type === "SPENDING_LIMIT" && input.categoryId === null) ctx.addIssue({ code: "custom", path: ["categoryId"], message: "Limite de gasto exige categoria." });
};

export const createGoalSchema = z.object({ ...fields, status: fields.status.default("IN_PROGRESS") }).superRefine(coherent);
export const updateGoalSchema = z.object(fields).superRefine(coherent);
export const goalListSchema = z.object({ page: z.coerce.number().int().positive().default(1), limit: z.coerce.number().int().positive().max(100).default(20), status: fields.status.optional() });
export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
export type GoalListInput = z.infer<typeof goalListSchema>;
