import { useCallback, useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, CreditCard, Plus, Wallet } from "lucide-react";
import { api } from "../api";
import { RecentTransactions } from "../components/RecentTransactions";
import { StatCard } from "../components/StatCard";
import { TransactionModal } from "../components/TransactionModal";
import { apiErrorMessage, currentMonth, money } from "../lib/format";
import type {
  Card,
  Category,
  EndingRecurrence,
  Summary,
  Transaction,
  TransactionType,
} from "../types";

interface DashboardPageProps {
  categories: Category[];
  cards?: Card[];
  refreshCards?: () => Promise<void>;
  onCategories: () => void;
}

export default function DashboardPage({
  categories,
  cards = [],
  onCategories,
}: DashboardPageProps) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newTransaction, setNewTransaction] = useState<TransactionType | null>(null);

  const load = useCallback(async () => {
    const { month, year } = currentMonth();
    setLoading(true);
    setError("");

    try {
      const [summaryResponse, transactionResponse] = await Promise.all([
        api.get<Summary>("/dashboard/summary", {
          params: { month, year },
        }),
        api.get<{ data: Transaction[] }>("/transactions", { params: { limit: 8 } }),
      ]);
      setSummary(summaryResponse.data);
      setTransactions(transactionResponse.data.data);
    } catch (requestError) {
      setError(apiErrorMessage(requestError, "Não foi possível carregar o painel."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const [ending, setEnding] = useState<EndingRecurrence[]>([]);
  const [endingError, setEndingError] = useState("");

  // O aviso é um extra: se falhar, o painel segue sem ele.
  const loadEnding = useCallback(async () => {
    try {
      const response = await api.get<{ recurrences: EndingRecurrence[] }>("/recurrences/ending");
      setEnding(response.data.recurrences ?? []);
    } catch {
      setEnding([]);
    }
  }, []);

  useEffect(() => {
    void loadEnding();
  }, [loadEnding]);

  const resolveRecurrence = async (recurrence: EndingRecurrence, action: "renew" | "finish") => {
    setEndingError("");

    try {
      if (action === "renew") await api.post(`/recurrences/${recurrence.id}/renew`);
      else await api.patch(`/recurrences/${recurrence.id}/finish`);
      setEnding((current) => current.filter(({ id }) => id !== recurrence.id));
      void load();
    } catch (requestError) {
      setEndingError(apiErrorMessage(requestError, "Não foi possível atualizar a recorrência."));
    }
  };

  const balance = summary?.netBalance ?? 0;

  return (
    <main className="min-h-screen bg-slate-100 p-5 sm:p-8 lg:ml-72 lg:p-10">
      <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-500">Visão geral</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            Olá, suas finanças.
          </h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={onCategories}
            className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:shadow-md"
          >
            Gerenciar categorias
          </button>
          <button
            onClick={() => setNewTransaction("EXPENSE")}
            className="flex items-center gap-2 rounded-full bg-finn-forest px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-finn-navy hover:shadow-lg"
          >
            <Plus size={18} />
            Nova transação
          </button>
        </div>
      </header>
      {error && (
        <p role="alert" className="mb-5 rounded-2xl bg-rose-50 px-5 py-4 text-sm text-rose-700">
          {error}
        </p>
      )}
      {ending.map((recurrence) => (
        <div
          key={recurrence.id}
          className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-amber-50 px-5 py-4 text-sm text-amber-900"
        >
          <span>
            {recurrence.description} termina em {recurrence.lastDate.slice(5, 7)}/
            {recurrence.lastDate.slice(0, 4)}.
          </span>
          <span className="flex gap-2">
            <button
              onClick={() => void resolveRecurrence(recurrence, "renew")}
              className="rounded-full bg-white px-4 py-2 font-semibold hover:bg-amber-100"
            >
              Renovar por 12 meses
            </button>
            <button
              onClick={() => void resolveRecurrence(recurrence, "finish")}
              className="rounded-full px-4 py-2 font-semibold hover:bg-amber-100"
            >
              Deixar terminar
            </button>
          </span>
        </div>
      ))}
      {endingError && (
        <p role="alert" className="mb-5 rounded-2xl bg-rose-50 px-5 py-4 text-sm text-rose-700">
          {endingError}
        </p>
      )}
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Receitas do mês"
          value={summary ? money(summary.totalIncome) : "—"}
          icon={<ArrowUpRight size={20} />}
        />
        <StatCard
          label="Despesas do mês"
          value={summary ? money(summary.totalExpense) : "—"}
          icon={<ArrowDownRight size={20} />}
        />
        <StatCard
          label="Resultado do mês"
          value={summary ? money(balance) : "—"}
          tone={balance >= 0 ? "positive" : "negative"}
          icon={<Wallet size={20} />}
        />
      </section>
      <section className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <RecentTransactions transactions={transactions} loading={loading} />
        <article className="rounded-3xl border border-transparent bg-finn-navy p-6 text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl">
          <p className="text-sm font-semibold text-slate-400">Acesso rápido</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">Organize seu mês</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Crie lançamentos e acompanhe a evolução das suas despesas.
          </p>
          <button
            onClick={() => setNewTransaction("INCOME")}
            className="mt-7 flex items-center gap-2 rounded-full bg-finn-lime px-4 py-2.5 text-sm font-semibold text-finn-forest transition hover:brightness-95"
          >
            <CreditCard size={17} />
            Adicionar dinheiro
          </button>
        </article>
      </section>
      {newTransaction && (
        <TransactionModal
          categories={categories}
          cards={cards}
          defaultType={newTransaction}
          onClose={() => setNewTransaction(null)}
          onSaved={load}
        />
      )}
    </main>
  );
}
