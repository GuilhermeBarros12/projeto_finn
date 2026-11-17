/**
 * Funções de calendário sobre strings AAAA-MM-DD. Nada aqui usa `Date` com fuso local: tudo passa
 * por `Date.UTC` e `getUTC*`, para o resultado não depender do fuso do navegador.
 */

export const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
export const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

const pad = (value: number): string => String(value).padStart(2, "0");

const toIso = (date: Date): string =>
  `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;

const fromIso = (isoDate: string): Date => new Date(`${isoDate}T00:00:00.000Z`);

/** `month` de 1 a 12. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 0 = domingo. */
export function weekdayOf(isoDate: string): number {
  return fromIso(isoDate).getUTCDay();
}

/** Seis semanas de sete dias. Dias fora do mês vêm com `inMonth: false`. */
export function monthGrid(
  year: number,
  month: number,
): { iso: string; day: number; inMonth: boolean }[][] {
  const offset = weekdayOf(`${year}-${pad(month)}-01`);
  const weeks: { iso: string; day: number; inMonth: boolean }[][] = [];

  for (let week = 0; week < 6; week += 1) {
    weeks.push(
      Array.from({ length: 7 }, (_, weekday) => {
        const date = new Date(Date.UTC(year, month - 1, 1 - offset + week * 7 + weekday));
        return {
          iso: toIso(date),
          day: date.getUTCDate(),
          inMonth: date.getUTCMonth() === month - 1 && date.getUTCFullYear() === year,
        };
      }),
    );
  }

  return weeks;
}

/** Soma dias a uma data AAAA-MM-DD. */
export function addDays(isoDate: string, days: number): string {
  return toIso(new Date(fromIso(isoDate).getTime() + days * 86_400_000));
}

/** Mesma regra da API: parte sempre da data original (31/01 + 1 = 28/02, + 2 = 31/03). */
export function addMonthsKeepingDay(isoDate: string, months: number): string {
  const [year, month, day] = isoDate.split("-").map(Number) as [number, number, number];
  const total = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(total / 12);
  const targetMonth = (((total % 12) + 12) % 12) + 1;
  const targetDay = Math.min(day, daysInMonth(targetYear, targetMonth));
  return `${targetYear}-${pad(targetMonth)}-${pad(targetDay)}`;
}

/** "seg, 16/11/2026" */
export function formatLongDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${WEEKDAYS[weekdayOf(isoDate)]}, ${day}/${month}/${year}`;
}

/** "16 de novembro de 2026", para leitores de tela. */
export function formatSpokenDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number) as [number, number, number];
  return `${day} de ${MONTHS[month - 1]} de ${year}`;
}
