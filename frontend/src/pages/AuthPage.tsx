import { useState, type FormEvent } from "react";
import { api, setAccessToken } from "../api";
import { apiErrorMessage } from "../lib/format";

const inputClass =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-finn-forest focus:ring-4 focus:ring-finn-lime/30";

interface AuthPageProps {
  notice?: string;
  onAuthenticated: () => void;
}

export function AuthPage({ notice = "", onAuthenticated }: AuthPageProps) {
  const [register, setRegister] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget));

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      if (register) {
        await api.post("/users", body);
        setRegister(false);
        setSuccess("Conta criada. Entre para continuar.");
      } else {
        const response = await api.post<{ token: string }>("/auth/login", body);
        setAccessToken(response.data.token);
        onAuthenticated();
      }
    } catch (requestError) {
      setError(apiErrorMessage(requestError, "Não foi possível concluir. Tente novamente."));
    } finally {
      setLoading(false);
    }
  };

  const message = success || (error ? "" : notice);

  return (
    <main className="grid min-h-screen place-items-center bg-finn-navy p-5">
      <form
        className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl sm:p-10"
        onSubmit={submit}
      >
        <span className="grid size-12 place-items-center rounded-2xl bg-finn-lime text-xl font-black text-finn-forest">
          F
        </span>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">
          {register ? "Crie sua conta" : "Seu dinheiro, claro."}
        </h1>
        <p className="mt-2 text-slate-500">Controle suas finanças de um jeito simples.</p>
        <div className="mt-7 space-y-3">
          {register && (
            <input
              className={inputClass}
              name="name"
              aria-label="Nome"
              placeholder="Nome"
              autoComplete="name"
              required
            />
          )}
          <input
            className={inputClass}
            name="email"
            type="email"
            aria-label="E-mail"
            placeholder="E-mail"
            autoComplete="email"
            required
          />
          <input
            className={inputClass}
            name="password"
            type="password"
            aria-label="Senha"
            placeholder={register ? "Senha (mínimo de 8 caracteres)" : "Senha"}
            autoComplete={register ? "new-password" : "current-password"}
            minLength={register ? 8 : undefined}
            required
          />
        </div>
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
          {loading ? "Aguarde..." : register ? "Cadastrar" : "Entrar"}
        </button>
        <button
          type="button"
          className="mt-4 w-full text-sm font-semibold text-finn-forest underline-offset-4 hover:underline"
          onClick={() => {
            setRegister(!register);
            setError("");
          }}
        >
          {register ? "Já tenho uma conta" : "Criar minha conta"}
        </button>
      </form>
    </main>
  );
}
