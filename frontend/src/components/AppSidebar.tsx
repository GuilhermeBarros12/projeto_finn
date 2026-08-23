import { BarChart3, FolderCog, LayoutDashboard, LogOut, ReceiptText, Target } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "../lib/cn";

const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/despesas", label: "Despesas", icon: ReceiptText },
];

export function AppSidebar({ onCategories, onSignOut }: { onCategories: () => void; onSignOut: () => void }) {
  return <aside className="flex min-h-screen w-full flex-col bg-finn-navy px-5 py-6 text-white lg:fixed lg:inset-y-0 lg:w-72">
    <div className="mb-10 flex items-center gap-3 px-3"><span className="grid size-10 place-items-center rounded-2xl bg-finn-lime text-xl font-black text-finn-forest">F</span><span className="text-2xl font-bold tracking-tight">Finn</span></div>
    <nav className="flex flex-1 gap-2 lg:flex-col">{links.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} className={({ isActive }) => cn("flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-all duration-200", isActive ? "bg-white text-finn-navy shadow-lg shadow-black/20" : "text-slate-300 hover:bg-white/10 hover:text-white")}><Icon size={20} />{label}</NavLink>)}
      <button onClick={onCategories} className="flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold text-slate-300 transition-all duration-200 hover:bg-white/10 hover:text-white"><FolderCog size={20} />Categorias</button>
      <button type="button" disabled className="flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold text-slate-500"><Target size={20} />Metas <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px]">em breve</span></button>
      <button type="button" disabled className="flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold text-slate-500"><BarChart3 size={20} />Insights <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px]">em breve</span></button>
    </nav>
    <button onClick={onSignOut} className="mt-6 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/10 hover:text-white"><LogOut size={19} />Sair</button>
  </aside>;
}
