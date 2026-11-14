import { useEffect, useRef, useState, type FormEvent } from "react";
import { LoaderCircle, SendHorizontal } from "lucide-react";
import { api } from "../api";
import { cn } from "../lib/cn";
import { apiErrorMessage } from "../lib/format";
import type { AgentMessage } from "../types";

// Número ímpar: com a conversa alternando, o recorte sempre começa em uma mensagem da pessoa.
const MAX_HISTORY = 19;

const suggestions = [
  "Quanto gastei este mês?",
  "Qual categoria pesou mais no mês passado?",
  "Como estão minhas metas?",
  "Onde posso economizar?",
];

export default function AssistantPage() {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, sending]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || sending) return;

    const history = [...messages, { role: "user" as const, content }];
    setMessages(history);
    setDraft("");
    setError("");
    setSending(true);

    try {
      const response = await api.post<{ reply: string }>("/agent/chat", {
        messages: history.slice(-MAX_HISTORY),
      });
      setMessages([...history, { role: "assistant", content: response.data.reply }]);
    } catch (requestError) {
      // Devolve o texto ao campo para a pessoa tentar de novo sem digitar outra vez.
      setMessages(messages);
      setDraft(content);
      setError(apiErrorMessage(requestError, "O assistente não conseguiu responder agora."));
    } finally {
      setSending(false);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void send(draft);
  };

  return (
    <main className="flex min-h-screen flex-col bg-slate-100 p-5 sm:p-8 lg:ml-72 lg:h-screen lg:p-10">
      <header>
        <p className="text-sm font-semibold text-slate-500">Rascunho</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">Assistente</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Ele lê seus lançamentos, categorias e metas para responder e sugerir, sem alterar nada.
          Suas perguntas e os dados consultados são enviados à Anthropic para gerar a resposta, e a
          conversa não fica salva.
        </p>
      </header>

      <section className="mt-6 flex min-h-[420px] flex-1 flex-col overflow-hidden rounded-3xl bg-white">
        <div
          ref={listRef}
          className="flex-1 space-y-3 overflow-y-auto overscroll-contain p-5 sm:p-6"
          aria-live="polite"
        >
          {messages.length === 0 && (
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => void send(suggestion)}
                  className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
          {messages.map((message, index) => (
            <p
              key={index}
              className={cn(
                "w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6",
                message.role === "user"
                  ? "ml-auto bg-finn-forest text-white"
                  : "bg-slate-100 text-slate-800",
              )}
            >
              {message.content}
            </p>
          ))}
          {sending && (
            <p role="status" className="flex items-center gap-2 text-sm text-slate-500">
              <LoaderCircle className="animate-spin" size={16} />
              Consultando seus dados…
            </p>
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="mx-5 mb-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700"
          >
            {error}
          </p>
        )}

        <form className="flex gap-2 border-t border-slate-100 p-4" onSubmit={submit}>
          <input
            className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-finn-forest focus:bg-white focus:ring-4 focus:ring-finn-lime/30"
            aria-label="Pergunta para o assistente"
            placeholder="Pergunte sobre seu dinheiro"
            maxLength={4000}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button
            aria-label="Enviar pergunta"
            disabled={sending || !draft.trim()}
            className="grid size-12 shrink-0 place-items-center rounded-2xl bg-finn-forest text-white transition hover:bg-finn-navy disabled:opacity-50"
          >
            <SendHorizontal size={18} />
          </button>
        </form>
      </section>
    </main>
  );
}
