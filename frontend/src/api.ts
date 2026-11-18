import axios, { type AxiosError } from "axios";

// A tela e a API ficam na mesma origem (proxy do Vite, nginx ou repasse da Vercel): o cookie de
// sessão é SameSite e HttpOnly, então nenhum script da página consegue ler a sessão.
const baseURL = import.meta.env.VITE_API_URL ?? "/api";

export const api = axios.create({ baseURL, withCredentials: true });

let onSessionExpired: () => void = () => undefined;

export const setSessionExpiredHandler = (handler: () => void): void => {
  onSessionExpired = handler;
};

/** Quem abre a página já pode ter uma sessão: o cookie diz, e o servidor confirma. */
export const fetchSession = async (): Promise<boolean> => {
  const response = await api.get<{ user: { id: string } } | null>("/auth/get-session");
  return Boolean(response.data?.user);
};

api.interceptors.response.use(undefined, (error: AxiosError) => {
  // Falhas das próprias rotas de login são erro de formulário, não sessão vencida.
  const isAuthRoute = error.config?.url?.startsWith("/auth/") ?? false;

  if (error.response?.status === 401 && !isAuthRoute) onSessionExpired();
  throw error;
});
