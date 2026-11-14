import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { api } from "../api";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { GoalModal } from "../components/GoalModal";
import { cn } from "../lib/cn";
import { apiErrorMessage, formatDate, money } from "../lib/format";
import type { Category, Goal, GoalStatus } from "../types";

const statusLabels: Record<GoalStatus, string> = {
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluída",
  EXPIRED: "Expirada",
};

const statusStyles: Record<GoalStatus, string> = {
  IN_PROGRESS: "bg-slate-100 text-slate-600",
  COMPLETED: "bg-finn-lime/40 text-finn-forest",
  EXPIRED: "bg-rose-50 text-rose-700",
};

function GoalCard({
  goal,
  onEdit,
  onRemove,
}: {
  goal: Goal;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const isLimit = goal.type === "SPENDING_LIMIT";
  const overLimit = isLimit && goal.progress > 100;

  return (
    <article className="rounded-3xl bg-white p-6 transition hover:shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-500">
            {isLimit ? `Limite · ${goal.category?.name ?? "Categoria"}` : "Economia"}
          </p>
          <h2 className="mt-1 truncate text-xl font-semibold tracking-tight">{goal.title}</h2>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-3 py-1 text-xs font-semibold",
            statusStyles[goal.status],
          )}
        >
          {statusLabels[goal.status]}
        </span>
      </div>
      <div
        className="mt-5 h-2.5 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-label={`Progresso de ${goal.title}`}
        aria-valuenow={Math.min(goal.progress, 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn("h-full rounded-full", overLimit ? "bg-rose-500" : "bg-finn-forest")}
          style={{ width: `${Math.min(goal.progress, 100)}%` }}
        />
      </div>
      <p className="mt-3 text-sm text-slate-600">
        {isLimit ? "Gasto" : "Guardado"} {money(goal.currentValue)} de {money(goal.targetValue)} (
        {goal.progress.toLocaleString("pt-BR")}%)
      </p>
      <p className="mt-1 text-sm text-slate-500">Prazo: {formatDate(goal.dueDate)}</p>
      <div className="mt-5 flex gap-2">
        <button
          onClick={onEdit}
          className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold hover:bg-slate-200"
        >
          Editar
        </button>
        <button
          onClick={onRemove}
          className="rounded-full px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-100"
        >
          Excluir
        </button>
      </div>
    </article>
  );
}

const PAGE_SIZE = 20;

interface GoalPage {
  data: Goal[];
  meta: { total: number };
}

export default function GoalsPage({ categories }: { categories: Category[] }) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Goal>();
  const [removing, setRemoving] = useState<Goal>();
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchPage = (page: number) =>
    api.get<GoalPage>("/goals", { params: { page, limit: PAGE_SIZE } });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetchPage(1);
      setGoals(response.data.data);
      setTotal(response.data.meta.total);
    } catch (requestError) {
      setError(apiErrorMessage(requestError, "Não foi possível carregar as metas."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = async () => {
    setLoadingMore(true);
    setError("");

    try {
      const response = await fetchPage(Math.floor(goals.length / PAGE_SIZE) + 1);
      const known = new Set(goals.map(({ id }) => id));
      setGoals([...goals, ...response.data.data.filter(({ id }) => !known.has(id))]);
      setTotal(response.data.meta.total);
    } catch (requestError) {
      setError(apiErrorMessage(requestError, "Não foi possível carregar mais metas."));
    } finally {
      setLoadingMore(false);
    }
  };

  const confirmRemoval = async () => {
    if (!removing) return;
    await api.delete(`/goals/${removing.id}`);
    setRemoving(undefined);
    await load();
  };

  return (
    <main className="min-h-screen bg-slate-100 p-5 sm:p-8 lg:ml-72 lg:p-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-500">Planejamento</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">Metas</h1>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex w-fit items-center gap-2 rounded-full bg-finn-forest px-5 py-3 text-sm font-semibold text-white transition hover:bg-finn-navy"
        >
          <Plus size={18} />
          Nova meta
        </button>
      </header>

      {error && (
        <p role="alert" className="mt-5 rounded-2xl bg-rose-50 px-5 py-4 text-sm text-rose-700">
          {error}
        </p>
      )}

      {loading ? (
        <div className="mt-6 rounded-3xl bg-white p-10 text-center text-slate-500">
          Carregando metas…
        </div>
      ) : goals.length === 0 ? (
        <div className="mt-6 rounded-3xl bg-white p-10 text-center text-slate-500">
          Você ainda não tem metas. Crie a primeira para acompanhar seu progresso.
        </div>
      ) : (
        <section className="mt-6 grid gap-5 lg:grid-cols-2">
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onEdit={() => setEditing(goal)}
              onRemove={() => setRemoving(goal)}
            />
          ))}
        </section>
      )}

      {!loading && goals.length < total && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:shadow-md disabled:opacity-60"
          >
            {loadingMore ? "Carregando..." : `Carregar mais metas (${goals.length} de ${total})`}
          </button>
        </div>
      )}

      {(creating || editing) && (
        <GoalModal
          categories={categories}
          initial={editing}
          onClose={() => {
            setCreating(false);
            setEditing(undefined);
          }}
          onSaved={load}
        />
      )}
      {removing && (
        <ConfirmDialog
          title="Excluir meta"
          message={`A meta "${removing.title}" será excluída definitivamente.`}
          onCancel={() => setRemoving(undefined)}
          onConfirm={confirmRemoval}
        />
      )}
    </main>
  );
}
