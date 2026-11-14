import { lazy, Suspense, useEffect, useState } from "react";
import { Download, Plus } from "lucide-react";
import { api } from "../api";
import { CategoryIcon } from "../components/CategoryIcon";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { TransactionModal } from "../components/TransactionModal";
import { apiErrorMessage, currentMonth, formatDate, money } from "../lib/format";
import type {
  Category,
  CategoryTotal,
  OriginTotals,
  PageMeta,
  Transaction,
  TransactionType,
} from "../types";

const TransactionCharts = lazy(() => import("../components/TransactionCharts"));

const inputClass =
  "rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-finn-forest focus:ring-4 focus:ring-finn-lime/30";
const PAGE_SIZE = 20;

const texts = {
  EXPENSE: {
    eyebrow: "Análise financeira",
    title: "Despesas",
    add: "Nova despesa",
    empty: "Nenhuma despesa encontrada neste período.",
  },
  INCOME: {
    eyebrow: "Entradas",
    title: "Receitas",
    add: "Nova receita",
    empty: "Nenhuma receita encontrada neste período.",
  },
};

const isValidYear = (year: string): boolean =>
  /^\d{4}$/.test(year) && +year >= 2000 && +year <= 2100;

const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

interface TransactionsPageProps {
  type: TransactionType;
  categories: Category[];
}

export default function TransactionsPage({ type, categories }: TransactionsPageProps) {
  const [month, setMonth] = useState(() => String(currentMonth().month));
  const [year, setYear] = useState(() => String(currentMonth().year));
  const [categoryId, setCategoryId] = useState("");
  const [origin, setOrigin] = useState("");
  const [page, setPage] = useState(1);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [byCategory, setByCategory] = useState<CategoryTotal[]>([]);
  const [byOrigin, setByOrigin] = useState<OriginTotals>({ account: 0, creditCard: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [editing, setEditing] = useState<Transaction>();
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<Transaction>();

  const text = texts[type];
  const yearIsValid = isValidYear(year);
  const filters = {
    type,
    month,
    year,
    ...(categoryId ? { categoryId } : {}),
    ...(origin ? { origin } : {}),
  };
  const filterKey = JSON.stringify(filters);

  useEffect(() => {
    if (!yearIsValid) return;

    const controller = new AbortController();
    const params = JSON.parse(filterKey) as Record<string, string>;
    const options = { params, signal: controller.signal };

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const [list, categoryTotals, originTotals] = await Promise.all([
          api.get<{ data: Transaction[]; meta: PageMeta }>("/transactions", {
            ...options,
            params: { ...params, page, limit: PAGE_SIZE },
          }),
          api.get<{ categories: CategoryTotal[] }>("/dashboard/by-category", options),
          api.get<OriginTotals>("/dashboard/by-origin", options),
        ]);
        setTransactions(list.data.data);
        setMeta(list.data.meta);
        setByCategory(categoryTotals.data.categories);
        setByOrigin(originTotals.data);
      } catch (requestError) {
        if (!controller.signal.aborted) {
          // Limpa o resultado anterior: ele seria lido como se fosse do filtro novo.
          setTransactions([]);
          setMeta(null);
          setByCategory([]);
          setByOrigin({ account: 0, creditCard: 0 });
          setError(apiErrorMessage(requestError, "Não foi possível carregar os lançamentos."));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void load();
    return () => controller.abort();
  }, [filterKey, page, reloadKey, yearIsValid]);

  const updateFilter = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };

  const reload = () => setReloadKey((key) => key + 1);

  const exportCsv = async () => {
    setExporting(true);
    setExportError("");

    try {
      const response = await api.get<Blob>("/exports/transactions", {
        params: { ...filters, format: "csv" },
        responseType: "blob",
      });
      downloadBlob(response.data, `finn-${text.title.toLowerCase()}-${year}-${month}.csv`);
    } catch (requestError) {
      setExportError(apiErrorMessage(requestError, "Não foi possível exportar."));
    } finally {
      setExporting(false);
    }
  };

  const confirmRemoval = async () => {
    if (!removing) return;
    await api.delete(`/transactions/${removing.id}`);
    setRemoving(undefined);
    if (transactions.length === 1 && page > 1) setPage(page - 1);
    else reload();
  };

  return (
    <main className="min-h-screen bg-slate-100 p-5 sm:p-8 lg:ml-72 lg:p-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-500">{text.eyebrow}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
            {text.title}
          </h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={exportCsv}
            disabled={exporting || !yearIsValid}
            className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:shadow-md disabled:opacity-60"
          >
            <Download size={17} />
            {exporting ? "Exportando..." : "Exportar CSV"}
          </button>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 rounded-full bg-finn-forest px-5 py-3 text-sm font-semibold text-white transition hover:bg-finn-navy"
          >
            <Plus size={18} />
            {text.add}
          </button>
        </div>
      </header>

      <section className="mt-7 flex flex-wrap gap-3">
        <select
          aria-label="Mês"
          className={inputClass}
          value={month}
          onChange={(event) => updateFilter(setMonth)(event.target.value)}
        >
          {Array.from({ length: 12 }, (_, index) => (
            <option key={index} value={index + 1}>
              {new Date(2026, index).toLocaleString("pt-BR", { month: "long" })}
            </option>
          ))}
        </select>
        <input
          aria-label="Ano"
          aria-invalid={!yearIsValid}
          className={`${inputClass} w-28`}
          value={year}
          type="number"
          min={2000}
          max={2100}
          onChange={(event) => updateFilter(setYear)(event.target.value)}
        />
        <select
          aria-label="Categoria"
          className={inputClass}
          value={categoryId}
          onChange={(event) => updateFilter(setCategoryId)(event.target.value)}
        >
          <option value="">Todas as categorias</option>
          {categories
            .filter((category) => category.type === type)
            .map((category) => (
              <option value={category.id} key={category.id}>
                {category.status ? category.name : `${category.name} (desativada)`}
              </option>
            ))}
        </select>
        {type === "EXPENSE" && (
          <select
            aria-label="Origem"
            className={inputClass}
            value={origin}
            onChange={(event) => updateFilter(setOrigin)(event.target.value)}
          >
            <option value="">Todas as origens</option>
            <option value="ACCOUNT">Conta corrente</option>
            <option value="CREDIT_CARD">Cartão de crédito</option>
          </select>
        )}
      </section>

      {!yearIsValid && (
        <p role="alert" className="mt-4 text-sm text-rose-700">
          Informe um ano entre 2000 e 2100.
        </p>
      )}
      {error && (
        <div
          role="alert"
          className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-rose-50 px-5 py-4 text-sm text-rose-700"
        >
          {error}
          <button
            onClick={reload}
            className="rounded-full bg-white px-4 py-2 font-semibold transition hover:bg-rose-100"
          >
            Tentar de novo
          </button>
        </div>
      )}
      {exportError && (
        <p role="alert" className="mt-4 rounded-2xl bg-rose-50 px-5 py-4 text-sm text-rose-700">
          {exportError}
        </p>
      )}

      {loading ? (
        <div className="mt-6 rounded-3xl bg-white p-10 text-center text-slate-500">
          Carregando lançamentos…
        </div>
      ) : error ? null : transactions.length === 0 ? (
        <div className="mt-6 rounded-3xl bg-white p-10 text-center text-slate-500">
          {text.empty}
        </div>
      ) : (
        <>
          <Suspense fallback={<div className="mt-6 h-72 rounded-3xl bg-white" />}>
            <TransactionCharts type={type} byCategory={byCategory} byOrigin={byOrigin} />
          </Suspense>
          <section className="mt-5 rounded-3xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Detalhamento</h2>
              <span className="text-sm text-slate-500">
                {meta?.total} {meta?.total === 1 ? "lançamento" : "lançamentos"}
              </span>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[720px] divide-y divide-slate-100">
                {transactions.map((transaction) => (
                  <div
                    className="grid grid-cols-[1.4fr_1fr_.8fr_.8fr_auto] items-center gap-4 py-4"
                    key={transaction.id}
                  >
                    <span>
                      <b className="block">{transaction.description}</b>
                      <small className="text-slate-500">{formatDate(transaction.date)}</small>
                    </span>
                    <span className="flex items-center gap-2">
                      <span style={{ color: transaction.category.color }}>
                        <CategoryIcon icon={transaction.category.icon} />
                      </span>
                      {transaction.category.name}
                    </span>
                    <span className="text-sm text-slate-500">
                      {transaction.paymentMethod === "CREDIT_CARD" ? "Cartão" : "Conta"}
                    </span>
                    <span className="font-semibold">{money(transaction.value)}</span>
                    <span className="flex gap-2">
                      <button
                        onClick={() => setEditing(transaction)}
                        className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold hover:bg-slate-200"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => setRemoving(transaction)}
                        className="rounded-full px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-100"
                      >
                        Excluir
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            </div>
            {meta && meta.totalPages > 1 && (
              <nav aria-label="Paginação" className="mt-5 flex items-center justify-end gap-3">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold hover:bg-slate-200 disabled:opacity-50"
                >
                  Anterior
                </button>
                <span className="text-sm text-slate-500">
                  Página {meta.page} de {meta.totalPages}
                </span>
                <button
                  disabled={page >= meta.totalPages}
                  onClick={() => setPage(page + 1)}
                  className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold hover:bg-slate-200 disabled:opacity-50"
                >
                  Próxima
                </button>
              </nav>
            )}
          </section>
        </>
      )}

      {(creating || editing) && (
        <TransactionModal
          categories={categories}
          initial={editing}
          defaultType={type}
          onClose={() => {
            setCreating(false);
            setEditing(undefined);
          }}
          onSaved={reload}
        />
      )}
      {removing && (
        <ConfirmDialog
          title="Excluir lançamento"
          message={`"${removing.description}" será excluído definitivamente.`}
          onCancel={() => setRemoving(undefined)}
          onConfirm={confirmRemoval}
        />
      )}
    </main>
  );
}
