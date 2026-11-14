import { useMemo, useState, type FormEvent } from "react";
import { api } from "../api";
import { cn } from "../lib/cn";
import { apiErrorMessage, todayInput, toDateInput } from "../lib/format";
import type { Category, Goal, GoalStatus, GoalType } from "../types";
import { CurrencyInput, fromCents, toCents } from "./CurrencyInput";
import { Modal } from "./Modal";

const inputClass =
  "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-finn-forest focus:bg-white focus:ring-4 focus:ring-finn-lime/30";

interface GoalModalProps {
  categories: Category[];
  initial?: Goal | undefined;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

export function GoalModal({ categories, initial, onClose, onSaved }: GoalModalProps) {
  const [type, setType] = useState<GoalType>(initial?.type ?? "SAVINGS");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [cents, setCents] = useState(() => toCents(initial?.targetValue));
  const [dueDate, setDueDate] = useState(initial ? toDateInput(initial.dueDate) : todayInput());
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [status, setStatus] = useState<GoalStatus>(initial?.status ?? "IN_PROGRESS");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const expenseCategories = useMemo(() => {
    const active = categories.filter((category) => category.type === "EXPENSE" && category.status);
    const current = initial?.category;

    // Uma categoria desativada some da lista, mas segue válida nesta meta.
    if (current && !active.some(({ id }) => id === current.id)) {
      return [...active, { id: current.id, name: `${current.name} (desativada)` }];
    }

    return active;
  }, [categories, initial]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const targetValue = fromCents(cents);
    if (targetValue <= 0 || (type === "SPENDING_LIMIT" && !categoryId)) {
      setError("Informe um valor positivo e, no limite de gasto, uma categoria.");
      return;
    }

    const body = {
      title,
      type,
      targetValue,
      dueDate,
      status,
      categoryId: type === "SPENDING_LIMIT" ? categoryId : null,
    };

    setError("");
    setSaving(true);

    try {
      if (initial) await api.put(`/goals/${initial.id}`, body);
      else await api.post("/goals", body);
      await onSaved();
      onClose();
    } catch (requestError) {
      setError(apiErrorMessage(requestError, "Não foi possível salvar a meta."));
      setSaving(false);
    }
  };

  const tabClass = (active: boolean) =>
    cn(
      "rounded-full py-2.5 text-sm font-semibold transition",
      active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500",
    );

  return (
    <Modal title={initial ? "Editar meta" : "Nova meta"} onClose={onClose}>
      <form className="mt-6 space-y-4" onSubmit={submit}>
        <div className="grid grid-cols-2 rounded-full bg-slate-100 p-1">
          <button
            type="button"
            className={tabClass(type === "SAVINGS")}
            onClick={() => setType("SAVINGS")}
          >
            Economia
          </button>
          <button
            type="button"
            className={tabClass(type === "SPENDING_LIMIT")}
            onClick={() => setType("SPENDING_LIMIT")}
          >
            Limite de gasto
          </button>
        </div>
        <input
          className={inputClass}
          aria-label="Título"
          placeholder="Título da meta"
          required
          maxLength={120}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <CurrencyInput
          label="Valor da meta"
          className={cn(inputClass, "text-lg font-semibold")}
          cents={cents}
          onChange={setCents}
        />
        <label className="block text-sm font-semibold text-slate-700">
          Prazo
          <input
            className={cn(inputClass, "mt-1 font-normal")}
            type="date"
            required
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />
        </label>
        {type === "SPENDING_LIMIT" && (
          <select
            aria-label="Categoria"
            className={inputClass}
            required
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">Selecione a categoria</option>
            {expenseCategories.map((category) => (
              <option value={category.id} key={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        )}
        {initial && (
          <select
            aria-label="Situação"
            className={inputClass}
            value={status}
            onChange={(event) => setStatus(event.target.value as GoalStatus)}
          >
            <option value="IN_PROGRESS">Em andamento</option>
            <option value="COMPLETED">Concluída</option>
            <option value="EXPIRED">Expirada</option>
          </select>
        )}
        {error && (
          <p role="alert" className="text-sm font-medium text-rose-600">
            {error}
          </p>
        )}
        <button
          className="w-full rounded-full bg-finn-forest px-5 py-3 font-semibold text-white transition hover:bg-finn-navy disabled:opacity-60"
          disabled={saving}
        >
          {saving ? "Salvando..." : "Salvar meta"}
        </button>
      </form>
    </Modal>
  );
}
