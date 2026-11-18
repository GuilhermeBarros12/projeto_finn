import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import { authErrorMessage } from "../lib/auth-errors";

const inputClass =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-finn-forest focus:ring-4 focus:ring-finn-lime/30";

const linkClass =
  "text-sm font-semibold text-finn-forest underline-offset-4 hover:underline disabled:opacity-60";

export type AuthMode = "login" | "register" | "forgot" | "reset";

interface AuthPageProps {
  notice?: string;
  /** Erro vindo da URL, como um link de redefinição vencido. */
  initialError?: string;
  /** Presente quando a pessoa chegou pelo link do e-mail. */
  resetToken?: string | null;
  onAuthenticated: () => void;
}

const TITLES: Record<AuthMode, string> = {
  login: "Seu dinheiro, claro.",
  register: "Crie sua conta",
  forgot: "Esqueceu a senha?",
  reset: "Escolha uma senha nova",
};

const SUBTITLES: Record<AuthMode, string> = {
  login: "Controle suas finanças de um jeito simples.",
  register: "Controle suas finanças de um jeito simples.",
  forgot: "Informe o e-mail da conta e enviaremos um link para criar outra senha.",
  reset: "Use pelo menos 8 caracteres. Depois, entre com a senha nova.",
};

const SUBMIT_LABELS: Record<AuthMode, string> = {
  login: "Entrar",
  register: "Cadastrar",
  forgot: "Enviar link",
  reset: "Salvar senha",
};

export function AuthPage({
  notice = "",
  initialError = "",
  resetToken = null,
  onAuthenticated,
}: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>(resetToken ? "reset" : "login");
  const [error, setError] = useState(initialError);
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLogin, setGoogleLogin] = useState(false);

  // O botão só aparece quando o servidor tem as credenciais do Google.
  useEffect(() => {
    api
      .get<{ googleLogin: boolean }>("/config")
      .then((response) => setGoogleLogin(response.data.googleLogin === true))
      .catch(() => setGoogleLogin(false));
  }, []);

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError("");
    setSuccess("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      if (mode === "register") {
        // O cadastro já abre a sessão.
        await api.post("/auth/sign-up/email", body);
        onAuthenticated();
      } else if (mode === "login") {
        await api.post("/auth/sign-in/email", body);
        onAuthenticated();
      } else if (mode === "forgot") {
        await api.post("/auth/request-password-reset", {
          email: body.email,
          redirectTo: `${window.location.origin}/redefinir-senha`,
        });
        // A mesma resposta com ou sem conta: quem pergunta não descobre quem tem cadastro.
        setSuccess(
          "Se existir uma conta com esse e-mail, enviamos um link para criar uma senha nova. Ele vale por 1 hora.",
        );
      } else {
        await api.post("/auth/reset-password", {
          token: resetToken,
          newPassword: body.password,
        });
        window.history.replaceState(null, "", "/");
        setMode("login");
        setSuccess("Senha alterada. Entre com a senha nova.");
      }
    } catch (requestError) {
      setError(authErrorMessage(requestError, "Não foi possível concluir. Tente novamente."));
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    setError("");
    setLoading(true);

    try {
      const response = await api.post<{ url?: string }>("/auth/sign-in/social", {
        provider: "google",
        callbackURL: "/",
        errorCallbackURL: "/",
      });
      if (!response.data.url) throw new Error("sem endereço de login");
      window.location.assign(response.data.url);
    } catch (requestError) {
      setError(authErrorMessage(requestError, "Não foi possível entrar com o Google."));
      setLoading(false);
    }
  };

  const message = success || (error ? "" : notice);
  const showGoogle = googleLogin && (mode === "login" || mode === "register");

  return (
    <main className="grid min-h-screen place-items-center bg-finn-navy p-5">
      <form
        className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl sm:p-10"
        onSubmit={submit}
      >
        <span className="grid size-12 place-items-center rounded-2xl bg-finn-lime text-xl font-black text-finn-forest">
          F
        </span>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">{TITLES[mode]}</h1>
        <p className="mt-2 text-slate-500">{SUBTITLES[mode]}</p>
        <div className="mt-7 space-y-3">
          {mode === "register" && (
            <input
              className={inputClass}
              name="name"
              aria-label="Nome"
              placeholder="Nome"
              autoComplete="name"
              minLength={2}
              required
            />
          )}
          {mode !== "reset" && (
            <input
              className={inputClass}
              name="email"
              type="email"
              aria-label="E-mail"
              placeholder="E-mail"
              autoComplete="email"
              required
            />
          )}
          {mode !== "forgot" && (
            <input
              className={inputClass}
              name="password"
              type="password"
              aria-label={mode === "reset" ? "Senha nova" : "Senha"}
              placeholder={
                mode === "reset"
                  ? "Senha nova (mínimo de 8 caracteres)"
                  : mode === "register"
                    ? "Senha (mínimo de 8 caracteres)"
                    : "Senha"
              }
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={mode === "login" ? undefined : 8}
              required
            />
          )}
        </div>
        {mode === "login" && (
          <button
            type="button"
            className={`${linkClass} mt-3`}
            onClick={() => switchMode("forgot")}
          >
            Esqueci minha senha
          </button>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm font-medium text-rose-600">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="mt-3 text-sm font-medium text-finn-forest">
            {message}
          </p>
        )}
        <button
          disabled={loading}
          className="mt-6 w-full rounded-full bg-finn-forest px-5 py-3 font-semibold text-white transition hover:bg-finn-navy disabled:opacity-60"
        >
          {loading ? "Aguarde..." : SUBMIT_LABELS[mode]}
        </button>
        {showGoogle && (
          <button
            type="button"
            disabled={loading}
            onClick={signInWithGoogle}
            className="mt-3 w-full rounded-full border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            Continuar com o Google
          </button>
        )}
        {(mode === "login" || mode === "register") && (
          <button
            type="button"
            className={`${linkClass} mt-4 w-full`}
            onClick={() => switchMode(mode === "register" ? "login" : "register")}
          >
            {mode === "register" ? "Já tenho uma conta" : "Criar minha conta"}
          </button>
        )}
        {(mode === "forgot" || mode === "reset") && (
          <button
            type="button"
            className={`${linkClass} mt-4 w-full`}
            onClick={() => {
              window.history.replaceState(null, "", "/");
              switchMode("login");
            }}
          >
            Voltar para o login
          </button>
        )}
      </form>
    </main>
  );
}
