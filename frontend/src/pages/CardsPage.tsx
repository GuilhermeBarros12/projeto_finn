import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, CreditCard, Plus } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { CardModal } from "../components/CardModal";
import { CategoryIcon } from "../components/CategoryIcon";
import { TransactionBadges } from "../components/TransactionBadges";
import { TransactionModal } from "../components/TransactionModal";
import { MONTHS } from "../lib/calendar";
import { apiErrorMessage, formatDate, money } from "../lib/format";
import type {
  Card,
  CardOverview,
  Category,
  Invoice,
  InvoiceStatus,
  InvoiceSummary,
} from "../types";

const statusLabels: Record<InvoiceStatus, string> = {
  CLOSED: "Fechada",
  OPEN: "Aberta",
  FUTURE: "Futura",
};

/** "2026-11-25" vira "25/11". */
const shortDate = (iso: string): string => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

const buttonClass =
  "rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold transition hover:bg-slate-200";

interface CardsPageProps {
  cards: Card[];
  refreshCards: () => Promise<void>;
}

function InvoiceLine({ label, invoice }: { label: string; invoice: InvoiceSummary }) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight">{money(invoice.total)}</p>
      <p className="mt-1 text-sm text-slate-500">
        {invoice.status === "OPEN" &&
          `${statusLabels.OPEN} · Fecha em ${shortDate(invoice.closingDate)} · `}
        Vence em {shortDate(invoice.dueDate)}
      </p>
    </div>
  );
}

export default function CardsPage({ cards, refreshCards }: CardsPageProps) {
  const [overview, setOverview] = useState<CardOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CardOverview["card"] | Card>();

  const load = useCallback(async () => {
    try {
      const response = await api.get<{ cards: CardOverview[] }>("/cards/overview");
      setOverview(response.data.cards);
      setError("");
    } catch (requestError) {
      setError(apiErrorMessage(requestError, "Não foi possível carregar os cartões."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saved = async () => {
    await refreshCards();
    await load();
  };

  const inactive = cards.filter((card) => !card.status);

  return (
    <main className="min-h-screen bg-slate-100 p-5 sm:p-8 lg:ml-72 lg:p-10">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">Crédito</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">Cartões</h1>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 rounded-full bg-finn-forest px-5 py-3 text-sm font-semibold text-white hover:bg-finn-navy"
        >
          <Plus size={18} /> Novo cartão
        </button>
      </header>

      {error && (
        <div
          role="alert"
          className="mt-6 flex items-center justify-between gap-3 rounded-2xl bg-rose-50 px-5 py-4 text-sm text-rose-700"
        >
          {error}
          <button
            onClick={() => void load()}
            className="rounded-full bg-white px-4 py-2 font-semibold"
          >
            Tentar de novo
          </button>
        </div>
      )}

      {!loading && !error && overview.length === 0 && (
        <section className="mt-8 rounded-3xl bg-white p-10 text-center shadow-sm">
          <CreditCard className="mx-auto text-slate-300" size={40} />
          <h2 className="mt-4 text-xl font-semibold">Nenhum cartão cadastrado</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            Cadastre seus cartões de crédito para acompanhar a fatura atual, a próxima e as parcelas
            de cada compra.
          </p>
          <button
            onClick={() => setCreating(true)}
            className="mt-6 rounded-full bg-finn-forest px-5 py-3 text-sm font-semibold text-white hover:bg-finn-navy"
          >
            Cadastrar primeiro cartão
          </button>
        </section>
      )}

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        {overview.map(({ card, current, next }) => (
          <section key={card.id} className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-semibold">
                  {card.name}
                  {card.isDefault && (
                    <span className="rounded-full bg-finn-lime px-2.5 py-0.5 text-xs font-bold text-finn-forest">
                      Padrão
                    </span>
                  )}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Fecha dia {card.closingDay} · vence dia {card.dueDay}
                </p>
              </div>
            </div>
            {card.datesConfirmedAt === null && (
              <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Confira os dias de fechamento e vencimento deste cartão. Enquanto isso, as faturas
                podem estar erradas.
                <button onClick={() => setEditing(card)} className="ml-2 font-semibold underline">
                  Ajustar agora
                </button>
              </div>
            )}
            <div className="mt-5 space-y-5">
              <InvoiceLine label="Fatura atual" invoice={current} />
              <InvoiceLine label="Próxima fatura" invoice={next} />
            </div>
            <div className="mt-6 flex gap-2">
              <Link to={`/cartoes/${card.id}`} className={buttonClass}>
                Ver faturas
              </Link>
              <button onClick={() => setEditing(card)} className={buttonClass}>
                Ajustar
              </button>
            </div>
          </section>
        ))}
      </div>

      {inactive.length > 0 && (
        <details className="mt-8 rounded-3xl bg-white p-6 shadow-sm">
          <summary className="cursor-pointer text-sm font-semibold text-slate-600">
            Cartões desativados
          </summary>
          <ul className="mt-4 divide-y divide-slate-100">
            {inactive.map((card) => (
              <li key={card.id} className="flex items-center justify-between py-3">
                <span>{card.name}</span>
                <Link to={`/cartoes/${card.id}`} className="text-sm font-semibold underline">
                  Ver faturas
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}

      {creating && <CardModal onClose={() => setCreating(false)} onSaved={saved} />}
      {editing && (
        <CardModal card={editing} onClose={() => setEditing(undefined)} onSaved={saved} />
      )}
    </main>
  );
}

interface CardDetailPageProps {
  cards: Card[];
  categories: Category[];
}

export function CardDetailPage({ cards, categories }: CardDetailPageProps) {
  const { cardId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const [invoice, setInvoice] = useState<Invoice>();
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Invoice["transactions"][number]>();
  const [creating, setCreating] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const year = Number(params.get("ano"));
  const month = Number(params.get("mes"));
  const hasRef = Number.isInteger(year) && year > 0 && month >= 1 && month <= 12;

  useEffect(() => {
    let active = true;
    const url = hasRef
      ? `/cards/${cardId}/invoices/${year}/${month}`
      : `/cards/${cardId}/invoices/current`;

    api
      .get<{ invoice: Invoice }>(url)
      .then((response) => {
        if (!active) return;
        setInvoice(response.data.invoice);
        setError("");
        // Grava a fatura atual na URL para as setas e o botão voltar funcionarem.
        if (!hasRef) {
          const { ref } = response.data.invoice;
          setParams({ ano: String(ref.year), mes: String(ref.month) }, { replace: true });
        }
      })
      .catch((requestError) => {
        if (active) setError(apiErrorMessage(requestError, "Não foi possível carregar a fatura."));
      });

    return () => {
      active = false;
    };
  }, [cardId, hasRef, year, month, reloadKey, setParams]);

  const go = (delta: number) => {
    const total = year * 12 + (month - 1) + delta;
    setParams({ ano: String(Math.floor(total / 12)), mes: String((total % 12) + 1) });
  };

  const card = cards.find(({ id }) => id === cardId);
  const reload = () => setReloadKey((key) => key + 1);

  return (
    <main className="min-h-screen bg-slate-100 p-5 sm:p-8 lg:ml-72 lg:p-10">
      <Link to="/cartoes" className="text-sm font-semibold text-slate-500 hover:underline">
        ← Cartões
      </Link>
      <header className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            {invoice?.card.name ?? card?.name ?? "Cartão"}
          </h1>
          {hasRef && (
            <div className="mt-3 flex items-center gap-2">
              <button
                aria-label="Fatura anterior"
                onClick={() => go(-1)}
                className="rounded-full bg-white p-2 shadow-sm"
              >
                <ChevronLeft size={18} />
              </button>
              <h2 className="min-w-48 text-center font-semibold">
                Fatura de {MONTHS[month - 1]} de {year}
              </h2>
              <button
                aria-label="Próxima fatura"
                onClick={() => go(1)}
                className="rounded-full bg-white p-2 shadow-sm"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 rounded-full bg-finn-forest px-5 py-3 text-sm font-semibold text-white hover:bg-finn-navy"
        >
          <Plus size={18} /> Novo lançamento no cartão
        </button>
      </header>

      {error && (
        <p role="alert" className="mt-6 rounded-2xl bg-rose-50 px-5 py-4 text-sm text-rose-700">
          {error}
        </p>
      )}

      {invoice && (
        <>
          <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <p className="text-4xl font-semibold tracking-tight">{money(invoice.total)}</p>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">
                {statusLabels[invoice.status]}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-500">
              Compras de {shortDate(invoice.start)} a {shortDate(invoice.end)} · Fecha em{" "}
              {shortDate(invoice.closingDate)} · Vence em {shortDate(invoice.dueDate)}
            </p>
          </section>
          <section className="mt-5 rounded-3xl bg-white p-6 shadow-sm">
            {invoice.transactions.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum lançamento nesta fatura.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {invoice.transactions.map((transaction) => (
                  <li key={transaction.id}>
                    <button
                      onClick={() => setEditing(transaction)}
                      className="grid w-full grid-cols-[5rem_1fr_auto] items-center gap-3 py-3 text-left"
                    >
                      <span className="text-sm text-slate-500">{formatDate(transaction.date)}</span>
                      <span>
                        <b className="block">
                          {transaction.description}
                          <TransactionBadges transaction={transaction} />
                        </b>
                        <small className="flex items-center gap-1 text-slate-500">
                          <span style={{ color: transaction.category.color }}>
                            <CategoryIcon icon={transaction.category.icon} />
                          </span>
                          {transaction.category.name}
                        </small>
                      </span>
                      <span className="font-semibold">{money(transaction.value)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {(creating || editing) && (
        <TransactionModal
          categories={categories}
          cards={cards}
          initial={editing}
          defaultOrigin="CREDIT_CARD"
          defaultCardId={cardId}
          onClose={() => {
            setCreating(false);
            setEditing(undefined);
          }}
          onSaved={reload}
        />
      )}
    </main>
  );
}
