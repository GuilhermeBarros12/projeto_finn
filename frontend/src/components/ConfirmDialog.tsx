import { useState } from "react";
import { apiErrorMessage } from "../lib/format";
import { Modal } from "./Modal";

interface ConfirmDialogProps {
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: (value?: string) => Promise<void>;
  /** Com opções, o diálogo mostra um botão por opção e passa o valor escolhido a `onConfirm`. */
  options?: { label: string; value: string }[];
}

export function ConfirmDialog({
  title,
  message,
  onCancel,
  onConfirm,
  options,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const confirm = async (value?: string) => {
    setBusy(true);
    setError("");

    try {
      await onConfirm(value);
    } catch (requestError) {
      setError(apiErrorMessage(requestError, "Não foi possível excluir."));
      setBusy(false);
    }
  };

  return (
    <Modal title={title} onClose={onCancel}>
      <p className="mt-4 text-sm text-slate-600">{message}</p>
      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-rose-600">
          {error}
        </p>
      )}
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button
          onClick={onCancel}
          className="rounded-full bg-slate-100 px-5 py-2.5 text-sm font-semibold hover:bg-slate-200"
        >
          Cancelar
        </button>
        {options ? (
          options.map((option) => (
            <button
              key={option.value}
              disabled={busy}
              onClick={() => confirm(option.value)}
              className="rounded-full bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
            >
              {option.label}
            </button>
          ))
        ) : (
          <button
            disabled={busy}
            onClick={() => confirm()}
            className="rounded-full bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
          >
            {busy ? "Excluindo..." : "Excluir"}
          </button>
        )}
      </div>
    </Modal>
  );
}
