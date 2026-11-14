import axios from "axios";

export const money = (value: number | string): string =>
  Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Datas de lançamento são dias do calendário, guardados à meia-noite UTC.
 * Sem fixar o fuso, 05/11 viraria 04/11 no horário de Brasília.
 */
export const formatDate = (value: string): string =>
  new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" });

/** O mesmo fuso que a API usa em APP_TIMEZONE, para tela e servidor concordarem sobre "hoje". */
export const APP_TIMEZONE: string = import.meta.env.VITE_APP_TIMEZONE ?? "America/Sao_Paulo";

/** Hoje no calendário do app; `toISOString` daria amanhã depois das 21h em Brasília. */
export const todayInput = (now = new Date(), timeZone = APP_TIMEZONE): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone }).format(now);

export const currentMonth = (now = new Date(), timeZone = APP_TIMEZONE) => {
  const [year, month] = todayInput(now, timeZone).split("-").map(Number);
  return { month: month as number, year: year as number };
};

export const toDateInput = (value: string): string => value.slice(0, 10);

interface ApiErrorBody {
  message?: string;
  issues?: Array<{ message: string }>;
}

export const apiErrorMessage = (error: unknown, fallback: string): string => {
  if (!axios.isAxiosError<ApiErrorBody>(error)) return fallback;
  if (!error.response) return "Não foi possível conectar ao servidor.";

  const { issues, message } = error.response.data ?? {};
  return issues?.[0]?.message ?? message ?? fallback;
};
