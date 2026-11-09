import { z } from "zod";
import { calendarDay } from "../lib/dates";

export const dashboardPeriodSchema = z.object({
  // Função, não constante: o padrão precisa ser recalculado a cada requisição.
  month: z.coerce
    .number()
    .int()
    .min(1)
    .max(12)
    .default(() => calendarDay(new Date()).getUTCMonth() + 1),
  year: z.coerce
    .number()
    .int()
    .min(2000)
    .max(2100)
    .default(() => calendarDay(new Date()).getUTCFullYear()),
  categoryId: z.uuid().optional(),
  origin: z.enum(["ACCOUNT", "CREDIT_CARD"]).optional(),
  type: z.enum(["INCOME", "EXPENSE"]).default("EXPENSE"),
});

export type DashboardPeriodInput = z.infer<typeof dashboardPeriodSchema>;
