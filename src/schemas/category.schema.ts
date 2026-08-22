import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(80),
  type: z.enum(["INCOME", "EXPENSE"]),
  icon: z.string().trim().min(1).max(32),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "A cor deve usar o formato hexadecimal #FFFFFF."),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
