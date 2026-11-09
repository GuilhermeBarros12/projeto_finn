import { z } from "zod";

const emailSchema = z
  .string()
  .trim()
  .max(254)
  .pipe(z.email("Informe um e-mail válido."))
  .transform((email) => email.toLowerCase());

// O bcrypt ignora tudo depois do 72º byte, e acentos ocupam mais de um byte.
const fitsBcrypt = (password: string): boolean => Buffer.byteLength(password, "utf8") <= 72;

export const createUserSchema = z.object({
  name: z.string().trim().min(2, "O nome deve ter pelo menos 2 caracteres.").max(120),
  email: emailSchema,
  password: z
    .string()
    .min(8, "A senha deve ter pelo menos 8 caracteres.")
    .refine(fitsBcrypt, "A senha deve ter no máximo 72 bytes."),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).refine(fitsBcrypt, "A senha deve ter no máximo 72 bytes."),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
