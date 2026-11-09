import axios from "axios";

export const money = (value: number | string): string =>
  Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Datas de lançamento são dias do calendário, guardados à meia-noite UTC.
 * Sem fixar o fuso, 05/11 viraria 04/11 no horário de Brasília.
 */
export const formatDate = (value: string): string =>
  new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" });

/** Hoje no calendário do usuário; `toISOString` daria amanhã depois das 21h em Brasília. */
export const todayInput = (now = new Date()): string => {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
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
