import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

// Em produção a tela e a API ficam na mesma origem (nginx ou repasse da Vercel), como o cookie exige.
const baseURL =
  import.meta.env.VITE_API_URL ?? (import.meta.env.PROD ? "/api" : "http://localhost:3333/api");

export const api = axios.create({ baseURL, withCredentials: true });

interface RetriableRequest extends InternalAxiosRequestConfig {
  retried?: boolean;
}

// Fica em memória de propósito: um script injetado não encontra o token no navegador.
let accessToken: string | null = null;
let refreshing: Promise<string> | null = null;
let onSessionExpired: () => void = () => undefined;

export const setAccessToken = (token: string): void => {
  accessToken = token;
};

export const clearSession = (): void => {
  accessToken = null;
};

export const setSessionExpiredHandler = (handler: () => void): void => {
  onSessionExpired = handler;
};

/** Várias requisições podem expirar juntas; todas aguardam a mesma renovação. */
export const refreshSession = (): Promise<string> => {
  refreshing ??= axios
    .post<{ token: string }>(`${baseURL}/auth/refresh`, null, { withCredentials: true })
    .then((response) => {
      accessToken = response.data.token;
      return response.data.token;
    })
    .finally(() => {
      refreshing = null;
    });

  return refreshing;
};

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

api.interceptors.response.use(undefined, async (error: AxiosError) => {
  const request = error.config as RetriableRequest | undefined;
  const isAuthRoute = request?.url?.startsWith("/auth/") ?? false;

  if (error.response?.status !== 401 || !request || request.retried || isAuthRoute) {
    throw error;
  }

  request.retried = true;

  try {
    await refreshSession();
  } catch (refreshError) {
    // Rede fora ou servidor com problema não encerram a sessão: o cookie segue válido.
    const isTemporary = axios.isAxiosError(refreshError) && refreshError.response?.status !== 401;
    if (!isTemporary) {
      clearSession();
      onSessionExpired();
    }
    throw error;
  }

  return api(request);
});
