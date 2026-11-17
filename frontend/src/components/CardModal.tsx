import { useState, type FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
import { api } from "../api";
import { apiErrorMessage } from "../lib/format";
import type { Card } from "../types";
import { ConfirmDialog } from "./ConfirmDialog";
import { Modal } from "./Modal";

const inputClass =
  "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-finn-forest focus:bg-white focus:ring-4 focus:ring-finn-lime/30";
const DAYS = Array.from({ length: 31 }, (_, index) => index + 1);
const SAME_DAYS = "O dia de fechamento e o de vencimento precisam ser diferentes.";

type EditableCard = Pick<Card, "id" | "name" | "closingDay" | "dueDay" | "isDefault">;

interface CardModalProps {
  card?: EditableCard | undefined;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

export function CardModal({ card, onClose, onSaved }: CardModalProps) {
  const [name, setName] = useState(card?.name ?? "");
  const [closingDay, setClosingDay] = useState(card?.closingDay ?? 25);
  const [dueDay, setDueDay] = useState(card?.dueDay ?? 5);
  const [makeDefault, setMakeDefault] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const finish = async () => {
    await onSaved();
    onClose();
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (closingDay === dueDay) {
      setError(SAME_DAYS);
      return;
    }

    setError("");
    setSaving(true);

    try {
      if (card) await api.put(`/cards/${card.id}`, { name, closingDay, dueDay });
      else await api.post("/cards", { name, closingDay, dueDay, isDefault: makeDefault });
      await finish();
    } catch (requestError) {
      setError(apiErrorMessage(requestError, "Não foi possível salvar o cartão."));
      setSaving(false);
    }
  };

  const setDefault = async () => {
    if (!card) return;
    setError("");
    setSaving(true);

    try {
      await api.patch(`/cards/${card.id}/default`);
      await finish();
    } catch (requestError) {
      setError(apiErrorMessage(requestError, "Não foi possível tornar o cartão padrão."));
      setSaving(false);
    }
  };

  const deactivate = async () => {
    if (!card) return;
    await api.patch(`/cards/${card.id}/deactivate`);
    await finish();
  };

  return (
    <Modal title={card ? "Ajustar cartão" : "Novo cartão"} onClose={onClose}>
      <form className="mt-6 space-y-4" onSubmit={submit}>
        <input
          className={inputClass}
          aria-label="Nome do cartão"
          required
          maxLength={60}
          placeholder="Nome do cartão"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-slate-600">
            Dia do fechamento
            <select
              className={`${inputClass} mt-1 font-normal`}
              value={closingDay}
              onChange={(event) => setClosingDay(Number(event.target.value))}
            >
              {DAYS.map((day) => (
                <option value={day} key={day}>
                  {day}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-600">
            Dia do vencimento
            <select
              className={`${inputClass} mt-1 font-normal`}
              value={dueDay}
              onChange={(event) => setDueDay(Number(event.target.value))}
            >
              {DAYS.map((day) => (
                <option value={day} key={day}>
                  {day}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="text-sm text-slate-500">
          Compras feitas a partir do dia {closingDay} entram na fatura seguinte.
          {(closingDay > 28 || dueDay > 28) && " Nos meses mais curtos, vale o último dia do mês."}
        </p>
        {!card && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={makeDefault}
              onChange={(event) => setMakeDefault(event.target.checked)}
            />
            Usar como cartão padrão
          </label>
        )}
        {error && (
          <p role="alert" className="text-sm font-medium text-rose-600">
            {error}
          </p>
        )}
        <button
          className="flex w-full items-center justify-center gap-2 rounded-full bg-finn-forest px-5 py-3 font-semibold text-white transition hover:bg-finn-navy disabled:opacity-60"
          disabled={saving}
        >
          {saving && <LoaderCircle className="animate-spin" size={17} />}
          {saving ? "Salvando..." : "Salvar cartão"}
        </button>
        {card && (
          <div className="flex flex-wrap justify-between gap-2">
            {!card.isDefault && (
              <button
                type="button"
                disabled={saving}
                onClick={setDefault}
                className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold hover:bg-slate-200"
              >
                Tornar padrão
              </button>
            )}
            <button
              type="button"
              disabled={saving}
              onClick={() => setConfirming(true)}
              className="ml-auto rounded-full px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-100"
            >
              Desativar cartão
            </button>
          </div>
        )}
      </form>
      {confirming && (
        <ConfirmDialog
          title="Desativar cartão"
          message="Os lançamentos e as faturas deste cartão continuam no histórico, mas ele não aparece mais para novos lançamentos."
          options={[{ label: "Desativar", value: "deactivate" }]}
          onCancel={() => setConfirming(false)}
          onConfirm={deactivate}
        />
      )}
    </Modal>
  );
}
