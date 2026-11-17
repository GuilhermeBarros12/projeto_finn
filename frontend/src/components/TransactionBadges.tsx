import { Repeat } from "lucide-react";
import type { Transaction } from "../types";

/** Selo "2/5" nas parcelas e ícone de repetição nas recorrências. */
export function TransactionBadges({
  transaction,
}: {
  transaction: Pick<Transaction, "installmentNumber" | "installmentCount" | "recurrenceId">;
}) {
  const { installmentNumber, installmentCount, recurrenceId } = transaction;

  return (
    <>
      {installmentNumber !== null && installmentCount !== null && (
        <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
          {installmentNumber}/{installmentCount}
        </span>
      )}
      {recurrenceId && (
        <span title="Recorrente" className="ml-2 inline-block align-middle text-slate-400">
          <Repeat size={14} aria-label="Recorrente" />
        </span>
      )}
    </>
  );
}

/** No crédito mostra o nome do cartão; fora dele, "Conta". */
export const originLabel = (transaction: Pick<Transaction, "paymentMethod" | "card">): string =>
  transaction.paymentMethod === "CREDIT_CARD" ? (transaction.card?.name ?? "Cartão") : "Conta";
