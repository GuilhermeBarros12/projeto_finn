import { useState, type FormEvent } from "react";
import { api } from "../api";
import { cn } from "../lib/cn";
import { apiErrorMessage } from "../lib/format";
import type { Category } from "../types";
import { categoryIconOptions } from "./category-icons";
import { CategoryIcon } from "./CategoryIcon";
import { Modal } from "./Modal";

const colors = [
  "#163300",
  "#9fe870",
  "#1458d4",
  "#7c3aed",
  "#db2777",
  "#dc2626",
  "#ea580c",
  "#ca8a04",
  "#16a34a",
  "#0891b2",
];
const inputClass =
  "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-finn-forest focus:bg-white focus:ring-4 focus:ring-finn-lime/30";

interface CategoryModalProps {
  categories: Category[];
  onClose: () => void;
  onChanged: () => void | Promise<void>;
}

export function CategoryModal({ categories, onClose, onChanged }: CategoryModalProps) {
  const [error, setError] = useState("");
  const [createdCode, setCreatedCode] = useState("");
  const [color, setColor] = useState(colors[0]);
  const [icon, setIcon] = useState("Utensils");
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // O React anula `currentTarget` ao fim do evento; depois do await ele já seria null.
    const form = event.currentTarget;

    setError("");
    setSaving(true);

    try {
      const response = await api.post<{ category: Category }>(
        "/categories",
        Object.fromEntries(new FormData(form)),
      );
      setCreatedCode(response.data.category.code);
      form.reset();
      setColor(colors[0]);
      setIcon("Utensils");
      await onChanged();
    } catch (requestError) {
      setError(apiErrorMessage(requestError, "Não foi possível criar a categoria."));
    } finally {
      setSaving(false);
    }
  };

  const disable = async (id: string) => {
    try {
      await api.patch(`/categories/${id}/deactivate`);
      await onChanged();
    } catch (requestError) {
      setError(apiErrorMessage(requestError, "Não foi possível desativar esta categoria."));
    }
  };

  return (
    <Modal title="Gerenciar categorias" onClose={onClose}>
      <form className="mt-6 space-y-5" onSubmit={submit}>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className={inputClass}
            name="name"
            aria-label="Nome da categoria"
            required
            placeholder="Nome da categoria"
          />
          <select className={inputClass} name="type" aria-label="Tipo">
            <option value="EXPENSE">Despesa</option>
            <option value="INCOME">Receita</option>
          </select>
        </div>
        <input type="hidden" name="icon" value={icon} />
        <input type="hidden" name="color" value={color} />
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-slate-700">Escolha um ícone</legend>
          <div className="flex flex-wrap gap-2">
            {categoryIconOptions.map((option) => (
              <button
                type="button"
                title={option.label}
                aria-label={option.label}
                aria-pressed={icon === option.value}
                className={cn(
                  "grid size-10 place-items-center rounded-xl border transition",
                  icon === option.value
                    ? "border-finn-forest bg-finn-lime text-finn-forest ring-4 ring-finn-lime/30"
                    : "border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50",
                )}
                onClick={() => setIcon(option.value)}
                key={option.value}
              >
                <CategoryIcon icon={option.value} />
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-slate-700">Escolha uma cor</legend>
          <div className="flex flex-wrap gap-3">
            {colors.map((option) => (
              <button
                type="button"
                title={option}
                aria-label={`Selecionar cor ${option}`}
                aria-pressed={color === option}
                className={cn(
                  "size-8 rounded-full border-4 border-white shadow-sm ring-1 ring-slate-200 transition hover:scale-110",
                  color === option && "ring-4 ring-finn-forest/35",
                )}
                style={{ backgroundColor: option }}
                onClick={() => setColor(option)}
                key={option}
              />
            ))}
          </div>
        </fieldset>
        <button
          disabled={saving}
          className="w-full rounded-full bg-finn-forest px-5 py-3 font-semibold text-white transition hover:bg-finn-navy disabled:opacity-60"
        >
          {saving ? "Criando..." : "Adicionar categoria"}
        </button>
        {error && (
          <p role="alert" className="text-sm font-medium text-rose-600">
            {error}
          </p>
        )}
        {createdCode && (
          <p
            role="status"
            className="rounded-2xl bg-finn-lime/30 px-4 py-3 text-sm text-finn-forest"
          >
            Código gerado: <strong>{createdCode}</strong>
          </p>
        )}
      </form>
      <div className="mt-7 border-t border-slate-100 pt-5">
        <h3 className="text-sm font-semibold text-slate-700">Suas categorias</h3>
        <div className="mt-3 space-y-2">
          {categories.map((category) => (
            <div
              className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-2.5"
              key={category.id}
            >
              <span style={{ color: category.color }}>
                <CategoryIcon icon={category.icon} />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{category.name}</span>
              <span className="hidden text-xs text-slate-400 sm:block">{category.code}</span>
              {category.status && category.userId !== null && (
                <button
                  className="rounded-full px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-100"
                  onClick={() => disable(category.id)}
                >
                  Desativar
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
