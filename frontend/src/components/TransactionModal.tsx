import { useMemo, useState, type FormEvent } from "react";
import { Link, useInRouterContext } from "react-router-dom";
import { LoaderCircle } from "lucide-react";
import { api } from "../api";
import { addMonthsKeepingDay } from "../lib/calendar";
import { cn } from "../lib/cn";
import { apiErrorMessage, formatDate, money, todayInput, toDateInput } from "../lib/format";
import type { Card, Category, Transaction, TransactionType } from "../types";
import { CurrencyInput, fromCents, toCents } from "./CurrencyInput";
import { DatePicker } from "./DatePicker";
import { Modal } from "./Modal";

type Mode = "SINGLE" | "INSTALLMENTS" | "RECURRING";
type ValueMode = "TOTAL" | "PER_INSTALLMENT";
type Scope = "ONE" | "FOLLOWING";

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

const MIN_INSTALLMENTS = 2;
const MAX_INSTALLMENTS = 48;

/** Mesma regra da API: no modo total, o centavo que sobra vai para a primeira parcela. */
export const splitInstallments = (cents: number, count: number, valueMode: ValueMode): number[] => {
  if (valueMode === "PER_INSTALLMENT") return Array.from({ length: count }, () => cents);

  const base = Math.floor(cents / count);
  return Array.from({ length: count }, (_, index) =>
    index === 0 ? base + (cents - base * count) : base,
  );
};

function RegisterCardLink() {
  const inRouter = useInRouterContext();
  const className = "font-semibold underline";
  const text = "Cadastre um cartão na página Cartões para lançar no crédito.";

  return (
    <p role="status" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
      {inRouter ? (
        <Link to="/cartoes" className={className}>
          {text}
        </Link>
      ) : (
        <a href="/cartoes" className={className}>
          {text}
        </a>
      )}
    </p>
  );
}

interface TransactionModalProps {
  categories: Category[];
  cards?: Card[];
  initial?: Transaction | undefined;
  defaultType?: TransactionType;
  defaultOrigin?: "ACCOUNT" | "CREDIT_CARD";
  defaultCardId?: string;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

export function TransactionModal({
  categories,
  cards = [],
  initial,
  defaultType = "EXPENSE",
  defaultOrigin = "ACCOUNT",
  defaultCardId,
  onClose,
  onSaved,
}: TransactionModalProps) {
  const [type, setType] = useState<TransactionType>(initial?.type ?? defaultType);
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [cents, setCents] = useState(() => toCents(initial?.value));
  const [origin, setOrigin] = useState<string>(
    initial ? (initial.paymentMethod === "CREDIT_CARD" ? "CREDIT_CARD" : "ACCOUNT") : defaultOrigin,
  );
  const [method, setMethod] = useState(
    initial && initial.paymentMethod !== "CREDIT_CARD" ? initial.paymentMethod : "PIX",
  );
  const [date, setDate] = useState(() => (initial ? toDateInput(initial.date) : todayInput()));
  const activeCards = useMemo(() => cards.filter((card) => card.status), [cards]);
  const [cardId, setCardId] = useState(
    () =>
      initial?.cardId ??
      defaultCardId ??
      activeCards.find((card) => card.isDefault)?.id ??
      activeCards[0]?.id ??
      "",
  );
  const [mode, setMode] = useState<Mode>("SINGLE");
  const [installmentCount, setInstallmentCount] = useState("2");
  const [valueMode, setValueMode] = useState<ValueMode>("TOTAL");
  const [endDate, setEndDate] = useState("");
  const [scope, setScope] = useState<Scope>("ONE");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const grouped = Boolean(initial?.installmentGroupId || initial?.recurrenceId);
  const isInstallment = Boolean(initial?.installmentGroupId);
  const creditCard = origin === "CREDIT_CARD";
  const canInstall = creditCard && type === "EXPENSE";

  const available = useMemo(() => {
    const active = categories.filter((category) => category.type === type && category.status);
    const current = initial?.category;

    // Uma categoria desativada some da lista, mas segue válida neste lançamento.
    if (current && initial.type === type && !active.some(({ id }) => id === current.id)) {
      return [...active, { id: current.id, name: `${current.name} (desativada)` }];
    }

    return active;
  }, [categories, initial, type]);

  const cardOptions = useMemo(() => {
    const current = initial?.card;

    // Um cartão desativado some da lista, mas segue válido neste lançamento.
    if (current && !activeCards.some(({ id }) => id === current.id)) {
      return [
        ...activeCards.map(({ id, name }) => ({ id, name })),
        {
          id: current.id,
          name: `${current.name} (desativado)`,
        },
      ];
    }

    return activeCards.map(({ id, name }) => ({ id, name }));
  }, [activeCards, initial]);

  const count = Number(installmentCount);
  const validCount =
    Number.isInteger(count) && count >= MIN_INSTALLMENTS && count <= MAX_INSTALLMENTS;
  const preview = useMemo(() => {
    const total = Number(cents);
    if (mode !== "INSTALLMENTS" || !validCount || !(total > 0)) return [];
    return splitInstallments(total, count, valueMode).map((amount, index) => ({
      number: index + 1,
      date: addMonthsKeepingDay(date, index),
      amount,
    }));
  }, [mode, validCount, cents, count, valueMode, date]);

  const changeType = (next: TransactionType) => {
    setType(next);
    if (next !== type) setCategoryId("");
    if (next === "INCOME") {
      setOrigin("ACCOUNT");
      if (mode === "INSTALLMENTS") setMode("SINGLE");
    }
  };

  const changeOrigin = (next: string) => {
    setOrigin(next);
    if (next !== "CREDIT_CARD" && mode === "INSTALLMENTS") setMode("SINGLE");
  };

  const changeDate = (next: string) => {
    setDate(next);
    if (endDate && endDate < next) setEndDate("");
  };

  const blocked = creditCard && !cardId;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const value = fromCents(cents);

    if (value <= 0 || !categoryId) {
      setError("Informe um valor positivo e uma categoria.");
      return;
    }

    if (mode === "INSTALLMENTS" && !validCount) {
      setError(`Informe de ${MIN_INSTALLMENTS} a ${MAX_INSTALLMENTS} parcelas.`);
      return;
    }

    const body: Record<string, unknown> = {
      description: form.get("description"),
      value,
      categoryId,
      type,
      paymentMethod: creditCard ? "CREDIT_CARD" : method,
    };

    if (creditCard) body.cardId = cardId;
    // "Este e os seguintes" nunca muda a data: a API recusa.
    if (!(grouped && scope === "FOLLOWING")) body.date = date;

    if (!initial) {
      body.mode = mode;
      if (mode === "INSTALLMENTS") body.installments = { count, valueMode };
      if (mode === "RECURRING") body.recurrence = endDate ? { endDate } : {};
    }

    setError("");
    setSaving(true);

    try {
      if (initial && grouped)
        await api.put(`/transactions/${initial.id}`, body, { params: { scope } });
      else if (initial) await api.put(`/transactions/${initial.id}`, body);
      else await api.post("/transactions", body);
      await onSaved();
      onClose();
    } catch (requestError) {
      setError(apiErrorMessage(requestError, "Não foi possível salvar a transação."));
      setSaving(false);
    }
  };

  const modes: Array<{ value: Mode; label: string; visible: boolean }> = [
    { value: "SINGLE", label: "À vista", visible: true },
    { value: "INSTALLMENTS", label: "Parcelado", visible: canInstall },
    { value: "RECURRING", label: "Recorrente", visible: true },
  ];

  const valueLabel =
    mode === "INSTALLMENTS"
      ? valueMode === "TOTAL"
        ? "Valor total da compra"
        : "Valor de cada parcela"
      : "Valor em reais";

  return (
    <Modal title={initial ? "Editar transação" : "Nova transação"} onClose={onClose}>
      <form className="mt-6 space-y-4" onSubmit={submit}>
        {grouped && initial && (
          <div className="space-y-2 rounded-2xl bg-slate-50 p-4 text-sm">
            <p className="font-semibold text-slate-800">
              {isInstallment
                ? `Parcela ${initial.installmentNumber} de ${initial.installmentCount}`
                : "Lançamento recorrente"}
            </p>
            <div
              className="flex flex-wrap gap-x-5 gap-y-1"
              role="radiogroup"
              aria-label="Escopo da edição"
            >
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="scope"
                  checked={scope === "ONE"}
                  onChange={() => setScope("ONE")}
                />
                Só este
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="scope"
                  checked={scope === "FOLLOWING"}
                  onChange={() => setScope("FOLLOWING")}
                />
                Este e os seguintes
              </label>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 rounded-full bg-slate-100 p-1">
          <button
            type="button"
            aria-pressed={type === "EXPENSE"}
            disabled={isInstallment}
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
            disabled={isInstallment}
            className={cn(
              "rounded-full py-2.5 text-sm font-semibold transition",
              type === "INCOME" ? "bg-finn-lime text-finn-forest shadow-sm" : "text-slate-500",
            )}
            onClick={() => changeType("INCOME")}
          >
            Receita
          </button>
        </div>
        {!initial && (
          <div
            className="grid grid-flow-col auto-cols-fr rounded-full bg-slate-100 p-1"
            role="group"
            aria-label="Modo do lançamento"
          >
            {modes
              .filter((option) => option.visible)
              .map((option) => (
                <button
                  type="button"
                  key={option.value}
                  aria-pressed={mode === option.value}
                  className={cn(
                    "rounded-full py-2 text-sm font-semibold transition",
                    mode === option.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500",
                  )}
                  onClick={() => setMode(option.value)}
                >
                  {option.label}
                </button>
              ))}
          </div>
        )}
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
          label={valueLabel}
          className={cn(inputClass, "text-lg font-semibold")}
          cents={cents}
          onChange={setCents}
        />
        {mode === "INSTALLMENTS" && (
          <div className="space-y-3 rounded-2xl bg-slate-50 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                className={inputClass}
                aria-label="Número de parcelas"
                type="number"
                inputMode="numeric"
                min={MIN_INSTALLMENTS}
                max={MAX_INSTALLMENTS}
                value={installmentCount}
                onChange={(event) => setInstallmentCount(event.target.value)}
              />
              <div
                className="flex items-center gap-4 text-sm"
                role="radiogroup"
                aria-label="Tipo de valor"
              >
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="valueMode"
                    checked={valueMode === "TOTAL"}
                    onChange={() => setValueMode("TOTAL")}
                  />
                  Valor total
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="valueMode"
                    checked={valueMode === "PER_INSTALLMENT"}
                    onChange={() => setValueMode("PER_INSTALLMENT")}
                  />
                  Valor da parcela
                </label>
              </div>
            </div>
            {preview.length > 0 && (
              <>
                <ul className="max-h-40 space-y-1 overflow-y-auto text-sm text-slate-600">
                  {preview.map((item) => (
                    <li key={item.number}>
                      {item.number}/{preview.length} · {formatDate(item.date)} ·{" "}
                      {money(item.amount / 100)}
                    </li>
                  ))}
                </ul>
                <p className="text-sm font-semibold text-slate-800">
                  Total: {money(preview.reduce((sum, item) => sum + item.amount, 0) / 100)}
                </p>
              </>
            )}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <DatePicker
            name="date"
            label="Data"
            value={date}
            onChange={changeDate}
            disabled={grouped && scope === "FOLLOWING"}
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
        {mode === "RECURRING" && (
          <div className="space-y-2 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            <p>Repete todo mês, por 12 meses.</p>
            <div className="flex items-center gap-2">
              {endDate ? (
                <>
                  <div className="flex-1">
                    <DatePicker
                      name="endDate"
                      label="Termina em"
                      value={endDate}
                      min={date}
                      onChange={setEndDate}
                    />
                  </div>
                  <button
                    type="button"
                    className="rounded-full px-3 py-2 font-semibold text-slate-500 hover:bg-slate-200"
                    onClick={() => setEndDate("")}
                  >
                    Limpar
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="rounded-full bg-white px-4 py-2 font-semibold text-finn-forest shadow-sm"
                  onClick={() => setEndDate(date)}
                >
                  Definir data final
                </button>
              )}
            </div>
          </div>
        )}
        {type === "EXPENSE" && (
          <select
            className={inputClass}
            aria-label="Origem"
            value={origin}
            disabled={isInstallment}
            onChange={(event) => changeOrigin(event.target.value)}
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
        {creditCard &&
          (cardOptions.length > 0 ? (
            <select
              className={inputClass}
              aria-label="Cartão"
              value={cardId}
              onChange={(event) => setCardId(event.target.value)}
            >
              {cardOptions.map((card) => (
                <option value={card.id} key={card.id}>
                  {card.name}
                </option>
              ))}
            </select>
          ) : (
            <RegisterCardLink />
          ))}
        {error && (
          <p role="alert" className="text-sm font-medium text-rose-600">
            {error}
          </p>
        )}
        <button
          className="flex w-full items-center justify-center gap-2 rounded-full bg-finn-forest px-5 py-3 font-semibold text-white transition hover:bg-finn-navy disabled:opacity-60"
          disabled={saving || blocked}
        >
          {saving && <LoaderCircle className="animate-spin" size={17} />}
          {saving ? "Salvando..." : "Salvar transação"}
        </button>
      </form>
    </Modal>
  );
}
