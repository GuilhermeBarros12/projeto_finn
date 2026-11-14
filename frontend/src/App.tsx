import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { api, clearSession, refreshSession, setSessionExpiredHandler } from "./api";
import { AppSidebar } from "./components/AppSidebar";
import { CategoryModal } from "./components/CategoryModal";
import { AuthPage } from "./pages/AuthPage";
import type { Category } from "./types";

const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const TransactionsPage = lazy(() => import("./pages/TransactionsPage"));
const GoalsPage = lazy(() => import("./pages/GoalsPage"));
const AssistantPage = lazy(() => import("./pages/AssistantPage"));

type SessionStatus = "loading" | "anonymous" | "authenticated";

function PageFallback() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 text-sm text-slate-500 lg:ml-72">
      Carregando…
    </main>
  );
}

function Workspace({ onSignOut }: { onSignOut: () => void }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesError, setCategoriesError] = useState(false);
  const [manageCategories, setManageCategories] = useState(false);

  // Inclui as desativadas para o histórico; cada formulário de criação filtra as ativas.
  const refreshCategories = useCallback(async () => {
    const response = await api.get<{ categories: Category[] }>("/categories", {
      params: { includeInactive: true },
    });
    setCategories(response.data.categories);
    setCategoriesError(false);
  }, []);

  // Uma falha aqui não pode parecer conta sem categorias.
  const loadCategories = useCallback(() => {
    refreshCategories().catch(() => setCategoriesError(true));
  }, [refreshCategories]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const openCategories = () => setManageCategories(true);

  return (
    <BrowserRouter>
      <AppSidebar onCategories={openCategories} onSignOut={onSignOut} />
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route
            path="/"
            element={<DashboardPage categories={categories} onCategories={openCategories} />}
          />
          <Route
            path="/despesas"
            element={<TransactionsPage key="EXPENSE" type="EXPENSE" categories={categories} />}
          />
          <Route
            path="/receitas"
            element={<TransactionsPage key="INCOME" type="INCOME" categories={categories} />}
          />
          <Route path="/metas" element={<GoalsPage categories={categories} />} />
          <Route path="/assistente" element={<AssistantPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      {manageCategories && (
        <CategoryModal
          categories={categories}
          onClose={() => setManageCategories(false)}
          onChanged={refreshCategories}
        />
      )}
      {categoriesError && (
        <div
          role="alert"
          className="fixed right-5 bottom-5 z-40 flex max-w-sm items-center gap-3 rounded-2xl bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700 shadow-xl"
        >
          Não foi possível carregar as categorias.
          <button
            onClick={loadCategories}
            className="shrink-0 rounded-full bg-white px-3 py-1.5 font-semibold text-rose-700 transition hover:bg-rose-100"
          >
            Tentar de novo
          </button>
        </div>
      )}
    </BrowserRouter>
  );
}

export function App() {
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [notice, setNotice] = useState("");
  const [signOutError, setSignOutError] = useState("");

  useEffect(() => {
    setSessionExpiredHandler(() => {
      setNotice("Sua sessão expirou. Entre novamente para continuar.");
      setStatus("anonymous");
    });

    // O token de acesso só existe em memória: ao recarregar, o cookie restaura a sessão.
    refreshSession()
      .then(() => setStatus("authenticated"))
      .catch(() => setStatus("anonymous"));
  }, []);

  const signOut = async () => {
    setSignOutError("");

    try {
      await api.post("/auth/logout");
    } catch {
      // Sem a confirmação, o cookie continua válido: dizer que saiu seria falso.
      setSignOutError("Não foi possível sair. Confira sua conexão e tente novamente.");
      return;
    }

    clearSession();
    setNotice("");
    setStatus("anonymous");
  };

  if (status === "loading") {
    return <div className="grid min-h-screen place-items-center text-slate-300">Carregando…</div>;
  }

  if (status === "anonymous") {
    return (
      <AuthPage
        notice={notice}
        onAuthenticated={() => {
          setNotice("");
          setStatus("authenticated");
        }}
      />
    );
  }

  return (
    <>
      <Workspace onSignOut={signOut} />
      {signOutError && (
        <p
          role="alert"
          className="fixed right-5 bottom-5 z-50 max-w-sm rounded-2xl bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700 shadow-xl"
        >
          {signOutError}
        </p>
      )}
    </>
  );
}
