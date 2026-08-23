import { FormEvent, useMemo, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { api } from "../api";
import type { Category, Transaction } from "../types";
import { Modal } from "./Modal";

const account = ["PIX", "DEBIT_CARD", "CASH", "BANK_TRANSFER", "OTHER"];
const initialCents = (value: string | number | undefined) => Math.round(Number(value ?? 0) * 100).toString();
const formatCurrency = (digits: string) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(digits || "0") / 100);

export function TransactionModal({ categories, initial, onClose, onSaved }: { categories: Category[]; initial?: Transaction; onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState<"INCOME" | "EXPENSE">(initial?.type ?? "EXPENSE");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [valueDigits, setValueDigits] = useState(() => initialCents(initial?.value));
  const [origin, setOrigin] = useState(initial?.paymentMethod === "CREDIT_CARD" ? "CREDIT_CARD" : "ACCOUNT");
  const available = useMemo(() => categories.filter(category => category.type === type && category.status), [categories, type]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget); const value = Number(valueDigits || "0") / 100;
    if (value <= 0 || !form.get("categoryId")) { setError("Informe um valor positivo e uma categoria."); return; }
    const body = { description: form.get("description"), value, date: form.get("date"), categoryId: form.get("categoryId"), type, paymentMethod: origin === "CREDIT_CARD" ? "CREDIT_CARD" : form.get("paymentMethod") };
    setError(""); setIsSaving(true);
    try { initial ? await api.put(`/transactions/${initial.id}`, body) : await api.post("/transactions", body); onSaved(); onClose(); } catch { setError("Não foi possível salvar a transação."); } finally { setIsSaving(false); }
  };
  return <Modal title={initial ? "Editar transação" : "Nova transação"} onClose={onClose}><form className="form" onSubmit={submit}>
    <div className="tabs"><button type="button" className={type === "EXPENSE" ? "active" : ""} onClick={() => setType("EXPENSE")}>Despesa</button><button type="button" className={type === "INCOME" ? "active" : ""} onClick={() => { setType("INCOME"); setOrigin("ACCOUNT"); }}>Receita</button></div>
    <input name="description" required placeholder="Descrição" defaultValue={initial?.description} />
    <input aria-label="Valor em reais" inputMode="numeric" placeholder="R$ 0,00" value={formatCurrency(valueDigits)} onChange={event => setValueDigits(event.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, ""))} />
    <input name="date" required type="date" defaultValue={(initial?.date ?? new Date().toISOString()).slice(0, 10)} />
    <select name="categoryId" required defaultValue={initial?.categoryId}><option value="">Selecione a categoria</option>{available.map(category => <option value={category.id} key={category.id}>{category.icon} {category.name}</option>)}</select>
    {type === "EXPENSE" && <select value={origin} onChange={event => setOrigin(event.target.value)}><option value="ACCOUNT">Saldo em conta</option><option value="CREDIT_CARD">Cartão de crédito</option></select>}
    {origin === "ACCOUNT" && <select name="paymentMethod" defaultValue={initial?.paymentMethod ?? "PIX"}>{account.map(method => <option key={method}>{method}</option>)}</select>}
    <small className="error">{error}</small><button className="primary submit-button" disabled={isSaving}>{isSaving && <LoaderCircle className="spinner" size={17} />} {isSaving ? "Salvando..." : "Salvar transação"}</button>
  </form></Modal>;
}
