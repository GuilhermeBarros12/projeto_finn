import { z } from "zod";

/** Maior valor que cabe em Decimal(15,2). Sem o teto, o excesso viraria erro 500 no banco. */
const MAX_MONEY = 9_999_999_999_999.99;
const CENTS_MESSAGE = "Informe um valor com no máximo duas casas decimais, usando ponto.";

// Confere o texto, não a conta: multiplicar float por 100 aprova ou recusa valores por acaso.
export const moneySchema = z
  .union([z.number().finite(), z.string().trim()])
  .transform(String)
  .pipe(z.string().regex(/^\d{1,13}(\.\d{1,2})?$/, CENTS_MESSAGE))
  .transform(Number)
  .pipe(
    z
      .number()
      .min(0.01, "O valor deve ser maior que zero.")
      .max(MAX_MONEY, "O valor excede o limite permitido."),
  );

/** Lançamentos e prazos são dias do calendário: só AAAA-MM-DD, guardado à meia-noite UTC. */
export const calendarDateSchema = z.iso
  .date("Informe uma data válida no formato AAAA-MM-DD.")
  .transform((date) => new Date(`${date}T00:00:00.000Z`));

export const paginationFields = {
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
};
