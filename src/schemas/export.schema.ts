import { z } from "zod";
export const exportFormatSchema = z.object({ format: z.enum(["json", "csv"]).default("json") });
