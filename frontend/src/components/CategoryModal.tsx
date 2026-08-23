import { FormEvent, useState } from "react";
import { api } from "../api";
import type { Category } from "../types";
import { CategoryIcon, categoryIconOptions } from "./CategoryIcon";
import { Modal } from "./Modal";

const colorOptions = ["#1458d4", "#7c3aed", "#db2777", "#dc2626", "#ea580c", "#ca8a04", "#16a34a", "#0891b2", "#475569", "#0f766e"];

export function CategoryModal({ categories, onClose, onChanged }: { categories: Category[]; onClose: () => void; onChanged: () => void }) {
  const [error, setError] = useState("");
  const [createdCode, setCreatedCode] = useState("");
  const [color, setColor] = useState(colorOptions[0]);
  const [icon, setIcon] = useState("Utensils");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError("");
    try { const response = await api.post("/categories", Object.fromEntries(new FormData(event.currentTarget))); setCreatedCode(response.data.category.code); onChanged(); event.currentTarget.reset(); setColor(colorOptions[0]); setIcon("Utensils"); }
    catch { setError("Não foi possível criar a categoria."); }
  };
  const disable = async (id: string) => { try { await api.patch(`/categories/${id}/deactivate`); onChanged(); } catch { setError("Não foi possível desativar."); } };

  return <Modal title="Gerenciar categorias" onClose={onClose}><form className="form compact" onSubmit={submit}>
    <input name="name" required placeholder="Nome" /><select name="type"><option value="EXPENSE">Despesa</option><option value="INCOME">Receita</option></select>
    <input type="hidden" name="icon" value={icon} /><input type="hidden" name="color" value={color} />
    <fieldset className="picker"><legend>Ícone</legend><div className="icon-grid">{categoryIconOptions.map(option => <button type="button" title={option.label} aria-label={option.label} className={`picker-button ${icon === option.value ? "selected" : ""}`} onClick={() => setIcon(option.value)} key={option.value}><CategoryIcon icon={option.value} /></button>)}</div></fieldset>
    <fieldset className="picker"><legend>Cor</legend><div className="color-grid">{colorOptions.map(option => <button type="button" title={option} aria-label={`Selecionar cor ${option}`} className={`color-button ${color === option ? "selected" : ""}`} style={{ backgroundColor: option }} onClick={() => setColor(option)} key={option} />)}</div></fieldset>
    <button className="primary">Adicionar categoria</button><small className="error">{error}</small>
    {createdCode && <small className="category-code">Código da última categoria criada: <strong>{createdCode}</strong></small>}
  </form><div className="category-list">{categories.map(category => <div key={category.id}><span className="category-list-icon" style={{ color: category.color }}><CategoryIcon icon={category.icon} /></span> {category.name}<em>{category.type === "EXPENSE" ? "Despesa" : "Receita"} · {category.code}</em>{category.status && category.userId !== null && <button className="link" onClick={() => disable(category.id)}>Desativar</button>}</div>)}</div></Modal>;
}
