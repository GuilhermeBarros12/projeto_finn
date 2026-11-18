import axios from "axios";

/** Códigos que o Better Auth devolve, em português. As mensagens dele vêm em inglês. */
const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "E-mail ou senha inválidos.",
  INVALID_EMAIL: "Informe um e-mail válido.",
  USER_ALREADY_EXISTS: "Já existe uma conta cadastrada com este e-mail.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Já existe uma conta cadastrada com este e-mail.",
  PASSWORD_TOO_SHORT: "A senha deve ter pelo menos 8 caracteres.",
  PASSWORD_TOO_LONG: "A senha deve ter no máximo 72 bytes.",
  INVALID_TOKEN: "O link expirou ou já foi usado. Peça um novo.",
  SIGNUP_CLOSED: "O cadastro está fechado para este e-mail.",
  PASSWORD_TOO_LONG_BYTES: "A senha deve ter no máximo 72 bytes.",
};

/** Motivos que voltam na URL depois do login com o Google ou do link de redefinição. */
const REDIRECT_MESSAGES: Record<string, string> = {
  INVALID_TOKEN: MESSAGES.INVALID_TOKEN as string,
  account_not_linked:
    "Já existe uma conta com este e-mail, criada com senha. Entre com a senha, ou use o link de esqueci a senha.",
  signup_closed: MESSAGES.SIGNUP_CLOSED as string,
};

export const redirectErrorMessage = (code: string): string =>
  REDIRECT_MESSAGES[code] ?? "Não foi possível entrar com o Google. Tente novamente.";

export const authErrorMessage = (error: unknown, fallback: string): string => {
  if (!axios.isAxiosError<{ code?: string; message?: string }>(error)) return fallback;
  if (!error.response) return "Não foi possível conectar ao servidor.";

  const { status, data } = error.response;
  if (data?.code && MESSAGES[data.code]) return MESSAGES[data.code] as string;
  // O limite de tentativas e o limite de tamanho respondem em português.
  if ((status === 429 || status === 413) && data?.message) return data.message;
  return fallback;
};
