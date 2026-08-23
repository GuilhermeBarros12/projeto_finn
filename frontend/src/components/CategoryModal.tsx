import { FormEvent, useState } from "react";
import { api } from "../api";
import type { Category } from "../types";
import { Modal } from "./Modal";

export function CategoryModal({ categories, onClose, onChanged }: { categories: Category[]; onClose: () => void; onChanged: () => void }) {
  const [error, setError] = useState("");
  const [createdCode, setCreatedCode] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError("");
    try { const response = await api.post("/categories", Object.fromEntries(new FormData(event.currentTarget))); setCreatedCode(response.data.category.code); onChanged(); event.currentTarget.reset(); }
    catch { setError("Não foi possível criar a categoria."); }
  };
  const disable = async (id: string) => { try { await api.patch(`/categories/${id}/deactivate`); onChanged(); } catch { setError("Não foi possível desativar."); } };

  return <Modal title="Gerenciar categorias" onClose={onClose}><form className="form compact" onSubmit={submit}>
    <input name="name" required placeholder="Nome" /><select name="type"><option value="EXPENSE">Despesa</option><option value="INCOME">Receita</option></select><input name="icon" required placeholder="Ícone" defaultValue="🏷️" /><input name="color" required pattern="#[0-9A-Fa-f]{6}" defaultValue="#1458d4" /><button>Adicionar categoria</button><small className="error">{error}</small>
    {createdCode && <small className="category-code">Código da última categoria criada: <strong>{createdCode}</strong></small>}
  </form><div className="category-list">{categories.map(category => <div key={category.id}><span style={{ color: category.color }}>{category.icon}</span> {category.name}<em>{category.type === "EXPENSE" ? "Despesa" : "Receita"} · {category.code}</em>{category.status && category.userId !== null && <button className="link" onClick={() => disable(category.id)}>Desativar</button>}</div>)}</div></Modal>;
}
