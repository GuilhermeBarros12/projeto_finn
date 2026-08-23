import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export function StatCard({ label, value, tone = "neutral", icon }: { label: string; value: string; tone?: "neutral" | "positive" | "negative"; icon: ReactNode }) {
  return <article className={cn("group rounded-3xl border border-transparent bg-white p-6 transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-xl", tone === "positive" && "bg-finn-lime text-finn-forest", tone === "negative" && "bg-rose-50 text-rose-900")}><div className="flex items-start justify-between"><span className="text-sm font-semibold opacity-70">{label}</span><span className="grid size-10 place-items-center rounded-2xl bg-slate-900/8">{icon}</span></div><strong className="mt-7 block text-3xl font-semibold tracking-tight">{value}</strong></article>;
}
