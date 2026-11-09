import { env } from "../config/env";

const DAY_IN_MS = 86_400_000;

/**
 * Lançamentos guardam o dia do calendário à meia-noite UTC. "Hoje" precisa seguir essa regra no
 * fuso do usuário: às 22h em Brasília, o relógio UTC já está no dia seguinte.
 */
export const calendarDay = (date: Date): Date => {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: env.APP_TIMEZONE });
  return new Date(`${formatter.format(date)}T00:00:00.000Z`);
};

export const addUtcDays = (date: Date, days: number): Date =>
  new Date(date.getTime() + days * DAY_IN_MS);
