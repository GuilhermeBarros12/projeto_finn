import {
  BarChart3,
  FolderCog,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  PiggyBank,
  ReceiptText,
  Target,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "../lib/cn";

const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/despesas", label: "Despesas", icon: ReceiptText },
  { to: "/receitas", label: "Receitas", icon: PiggyBank },
  { to: "/metas", label: "Metas", icon: Target },
  { to: "/assistente", label: "Assistente", icon: MessageCircle },
];

const itemClass =
  "flex shrink-0 items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition-all duration-200";

interface AppSidebarProps {
  onCategories: () => void;
  onSignOut: () => void;
}

export function AppSidebar({ onCategories, onSignOut }: AppSidebarProps) {
  return (
    <aside className="flex w-full flex-wrap items-center gap-3 bg-finn-navy px-5 py-4 text-white lg:fixed lg:inset-y-0 lg:w-72 lg:flex-col lg:flex-nowrap lg:items-stretch lg:py-6">
      <div className="flex items-center gap-3 lg:mb-7 lg:px-3">
        <span className="grid size-10 place-items-center rounded-2xl bg-finn-lime text-xl font-black text-finn-forest">
          F
        </span>
        <span className="text-2xl font-bold tracking-tight">Finn</span>
      </div>
      <nav className="order-last flex w-full gap-2 overflow-x-auto lg:order-none lg:flex-1 lg:flex-col">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                itemClass,
                isActive
                  ? "bg-white text-finn-navy shadow-lg shadow-black/20"
                  : "text-slate-300 hover:bg-white/10 hover:text-white",
              )
            }
          >
            <Icon size={20} />
            {label}
          </NavLink>
        ))}
        <button
          onClick={onCategories}
          className={cn(itemClass, "text-slate-300 hover:bg-white/10 hover:text-white")}
        >
          <FolderCog size={20} />
          Categorias
        </button>
        <button type="button" disabled className={cn(itemClass, "text-slate-500")}>
          <BarChart3 size={20} />
          Insights
          <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px]">em breve</span>
        </button>
      </nav>
      <button
        onClick={onSignOut}
        className={cn(
          itemClass,
          "ml-auto text-slate-300 hover:bg-white/10 hover:text-white lg:ml-0 lg:mt-6",
        )}
      >
        <LogOut size={19} />
        Sair
      </button>
    </aside>
  );
}
