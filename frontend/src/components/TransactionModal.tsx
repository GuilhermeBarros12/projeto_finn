import { useMemo, useState, type FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
import { api } from "../api";
import { cn } from "../lib/cn";
import { apiErrorMessage, todayInput, toDateInput } from "../lib/format";
import type { Category, Transaction, TransactionType } from "../types";
import { CurrencyInput, fromCents, toCents } from "./CurrencyInput";
import { Modal } from "./Modal";

const accountMethods = ["PIX", "DEBIT_CARD", "CASH", "BANK_TRANSFER", "OTHER"];
const paymentLabels: Record<string, string> = {
  PIX: "PIX",
  DEBIT_CARD: "Cartão de débito",
  CASH: "Dinheiro",
  BANK_TRANSFER: "Transferência",
  OTHER: "Outro",
};
const inputClass =
  "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-finn-forest focus:bg-white focus:ring-4 focus:ring-finn-lime/30";

interface TransactionModalProps {
  categories: Category[];
  initial?: Transaction | undefined;
  defaultType?: TransactionType;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

export function TransactionModal({
  categories,
  initial,
  defaultType = "EXPENSE",
  onClose,
  onSaved,
}: TransactionModalProps) {
  const [type, setType] = useState<TransactionType>(initial?.type ?? defaultType);
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [cents, setCents] = useState(() => toCents(initial?.value));
  const [origin, setOrigin] = useState(
    initial?.paymentMethod === "CREDIT_CARD" ? "CREDIT_CARD" : "ACCOUNT",
  );
  const [method, setMethod] = useState(
    initial && initial.paymentMethod !== "CREDIT_CARD" ? initial.paymentMethod : "PIX",
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const available = useMemo(() => {
    const active = categories.filter((category) => category.type === type && category.status);
    const current = initial?.category;

    // Uma categoria desativada some da lista, mas segue válida neste lançamento.
    if (current && initial.type === type && !active.some(({ id }) => id === current.id)) {
      return [...active, { id: current.id, name: `${current.name} (desativada)` }];
    }

    return active;
  }, [categories, initial, type]);

  const changeType = (next: TransactionType) => {
    setType(next);
    if (next !== type) setCategoryId("");
    if (next === "INCOME") setOrigin("ACCOUNT");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const value = fromCents(cents);

    if (value <= 0 || !categoryId) {
      setError("Informe um valor positivo e uma categoria.");
      return;
    }

    const body = {
      description: form.get("description"),
      value,
      date: form.get("date"),
      categoryId,
      type,
      paymentMethod: origin === "CREDIT_CARD" ? "CREDIT_CARD" : method,
    };

    setError("");
    setSaving(true);

    try {
      if (initial) await api.put(`/transactions/${initial.id}`, body);
      else await api.post("/transactions", body);
      await onSaved();
      onClose();
    } catch (requestError) {
      setError(apiErrorMessage(requestError, "Não foi possível salvar a transação."));
      setSaving(false);
    }
  };

  return (
    <Modal title={initial ? "Editar transação" : "Nova transação"} onClose={onClose}>
      <form className="mt-6 space-y-4" onSubmit={submit}>
        <div className="grid grid-cols-2 rounded-full bg-slate-100 p-1">
          <button
            type="button"
            aria-pressed={type === "EXPENSE"}
            className={cn(
              "rounded-full py-2.5 text-sm font-semibold transition",
              type === "EXPENSE" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500",
            )}
            onClick={() => changeType("EXPENSE")}
          >
            Despesa
          </button>
          <button
            type="button"
            aria-pressed={type === "INCOME"}
            className={cn(
              "rounded-full py-2.5 text-sm font-semibold transition",
              type === "INCOME" ? "bg-finn-lime text-finn-forest shadow-sm" : "text-slate-500",
            )}
            onClick={() => changeType("INCOME")}
          >
            Receita
          </button>
        </div>
        <input
          className={inputClass}
          name="description"
          aria-label="Descrição"
          required
          maxLength={255}
          placeholder="Descrição"
          defaultValue={initial?.description}
        />
        <CurrencyInput
          label="Valor em reais"
          className={cn(inputClass, "text-lg font-semibold")}
          cents={cents}
          onChange={setCents}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className={inputClass}
            name="date"
            aria-label="Data"
            required
            type="date"
            defaultValue={initial ? toDateInput(initial.date) : todayInput()}
          />
          <select
            className={inputClass}
            aria-label="Categoria"
            required
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">Selecione a categoria</option>
            {available.map((category) => (
              <option value={category.id} key={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        {type === "EXPENSE" && (
          <select
            className={inputClass}
            aria-label="Origem"
            value={origin}
            onChange={(event) => setOrigin(event.target.value)}
          >
            <option value="ACCOUNT">Saldo em conta</option>
            <option value="CREDIT_CARD">Cartão de crédito</option>
          </select>
        )}
        {origin === "ACCOUNT" && (
          <select
            className={inputClass}
            aria-label="Forma de pagamento"
            value={method}
            onChange={(event) => setMethod(event.target.value)}
          >
            {accountMethods.map((option) => (
              <option value={option} key={option}>
                {paymentLabels[option]}
              </option>
            ))}
          </select>
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
          {saving ? "Salvando..." : "Salvar transação"}
        </button>
      </form>
    </Modal>
  );
}
