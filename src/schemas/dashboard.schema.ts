import { z } from "zod";

const now = new Date();

export const dashboardPeriodSchema = z.object({
  month: z.coerce.number().int().min(1).max(12).default(now.getUTCMonth() + 1),
  year: z.coerce.number().int().min(2000).max(2100).default(now.getUTCFullYear()),
});

export type DashboardPeriodInput = z.infer<typeof dashboardPeriodSchema>;
