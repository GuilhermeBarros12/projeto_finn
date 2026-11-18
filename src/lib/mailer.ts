import { env } from "../config/env";
import { logger } from "./logger";

export interface Email {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** Nos testes os e-mails ficam aqui, para a suíte ler o link sem enviar nada. */
export const sentEmails: Email[] = [];

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

export const sendEmail = async (email: Email): Promise<void> => {
  if (env.NODE_ENV === "test") {
    sentEmails.push(email);
    return;
  }

  if (!env.RESEND_API_KEY) {
    // Em desenvolvimento o link no log basta; em produção sem chave o erro precisa aparecer.
    if (env.NODE_ENV === "production") {
      logger.error({ to: email.to }, "RESEND_API_KEY ausente: o e-mail não foi enviado");
      return;
    }
    logger.info({ to: email.to, subject: email.subject }, `E-mail simulado:\n${email.text}`);
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: email.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    // O corpo não vai para o log: pode repetir o endereço ou o conteúdo do e-mail.
    throw new Error(`O serviço de e-mail respondeu ${response.status}.`);
  }
};

export const sendPasswordResetEmail = async (
  to: string,
  name: string,
  url: string,
): Promise<void> => {
  const text = [
    `Olá, ${name}.`,
    "",
    "Recebemos um pedido para redefinir a senha da sua conta no Finn.",
    "Abra o link para escolher uma senha nova (vale por 1 hora e só pode ser usado uma vez):",
    url,
    "",
    "Se não foi você, ignore este e-mail: nada muda na sua conta.",
  ].join("\n");

  const html = `<p>Olá, ${escapeHtml(name)}.</p>
<p>Recebemos um pedido para redefinir a senha da sua conta no Finn.</p>
<p><a href="${escapeHtml(url)}">Escolher uma senha nova</a></p>
<p>O link vale por 1 hora e só pode ser usado uma vez.</p>
<p>Se não foi você, ignore este e-mail: nada muda na sua conta.</p>`;

  await sendEmail({ to, subject: "Redefinir sua senha do Finn", html, text });
};
