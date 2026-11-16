/**
 * Regras de calendário da fatura do cartão. Tudo aqui são funções puras sobre datas à meia-noite
 * UTC (o formato de `Transaction.date`). Quem precisa de "hoje" recebe `calendarDay(new Date())`.
 */

export interface CardDays {
  closingDay: number; // 1..31
  dueDay: number; // 1..31, diferente de closingDay
}

export interface InvoiceRef {
  year: number;
  month: number; // 1..12, mês do VENCIMENTO
}

export interface InvoicePeriod {
  ref: InvoiceRef;
  start: Date; // inclusivo: data do fechamento anterior
  closingDate: Date; // exclusivo: compras nesta data já vão para a fatura seguinte
  dueDate: Date;
}

/** Soma `months` a um par ano/mês (`month` de 1 a 12). */
export function shiftInvoiceRef(ref: InvoiceRef, months: number): InvoiceRef {
  const total = ref.year * 12 + (ref.month - 1) + months;
  return { year: Math.floor(total / 12), month: (((total % 12) + 12) % 12) + 1 };
}

/** Dia `day` do mês, ou o último dia quando o mês é mais curto. `month` é 1..12. */
export function clampedDate(year: number, month: number, day: number): Date {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return new Date(Date.UTC(year, month - 1, Math.min(day, lastDay)));
}

/** A mesma data `months` meses depois, mantendo o dia de `date` (31/01 + 1 = 28/02, + 2 = 31/03). */
export function addMonthsKeepingDay(date: Date, months: number): Date {
  const target = shiftInvoiceRef(
    { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 },
    months,
  );
  return clampedDate(target.year, target.month, date.getUTCDate());
}

/**
 * O vencimento cai no mesmo mês do fechamento quando o dia de vencimento é maior que o de
 * fechamento, e no mês seguinte quando é menor. A comparação usa os dias configurados, não as
 * datas já ajustadas a meses curtos: assim cada vencimento pertence a um único fechamento.
 */
function dueMonthOffset(card: CardDays): 0 | 1 {
  return card.dueDay > card.closingDay ? 0 : 1;
}

/** Período de uma fatura identificada pelo mês do vencimento. */
export function invoicePeriod(card: CardDays, ref: InvoiceRef): InvoicePeriod {
  const closingMonth = shiftInvoiceRef(ref, -dueMonthOffset(card));
  const previousMonth = shiftInvoiceRef(closingMonth, -1);
  return {
    ref: { year: ref.year, month: ref.month },
    start: clampedDate(previousMonth.year, previousMonth.month, card.closingDay),
    closingDate: clampedDate(closingMonth.year, closingMonth.month, card.closingDay),
    dueDate: clampedDate(ref.year, ref.month, card.dueDay),
  };
}

/** Fatura em que cai uma compra feita em `date`. */
export function invoiceForDate(card: CardDays, date: Date): InvoicePeriod {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  // Compra no dia do fechamento já entra na fatura seguinte.
  const closingMonth =
    date < clampedDate(year, month, card.closingDay)
      ? { year, month }
      : shiftInvoiceRef({ year, month }, 1);
  return invoicePeriod(card, shiftInvoiceRef(closingMonth, dueMonthOffset(card)));
}
