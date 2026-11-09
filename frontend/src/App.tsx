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
  const [manageCategories, setManageCategories] = useState(false);

  const refreshCategories = useCallback(async () => {
    const response = await api.get<{ categories: Category[] }>("/categories");
    setCategories(response.data.categories);
  }, []);

  useEffect(() => {
    refreshCategories().catch(() => setCategories([]));
  }, [refreshCategories]);

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
    </BrowserRouter>
  );
}

export function App() {
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [notice, setNotice] = useState("");

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
    await api.post("/auth/logout").catch(() => undefined);
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

  return <Workspace onSignOut={signOut} />;
}
