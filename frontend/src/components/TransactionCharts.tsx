import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { money } from "../lib/format";
import type { CategoryTotal, OriginTotals, TransactionType } from "../types";

interface TransactionChartsProps {
  type: TransactionType;
  byCategory: CategoryTotal[];
  byOrigin: OriginTotals;
}

export default function TransactionCharts({ type, byCategory, byOrigin }: TransactionChartsProps) {
  const originData = [
    { name: "Conta", total: byOrigin.account },
    { name: "Cartão", total: byOrigin.creditCard },
  ];

  return (
    <section className={`mt-6 grid gap-5 ${type === "EXPENSE" ? "lg:grid-cols-2" : ""}`}>
      <article className="rounded-3xl bg-white p-6 transition hover:shadow-xl">
        <h2 className="font-semibold">Por categoria</h2>
        <ResponsiveContainer width="100%" height={230}>
          <PieChart>
            <Pie
              data={byCategory}
              dataKey="total"
              nameKey="category.name"
              innerRadius={60}
              outerRadius={95}
            >
              {byCategory.map((item) => (
                <Cell key={item.category.id} fill={item.category.color} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => money(Number(value ?? 0))} />
          </PieChart>
        </ResponsiveContainer>
        <ul className="mt-3 space-y-1.5 text-sm">
          {byCategory.map((item) => (
            <li className="flex items-center gap-2" key={item.category.id}>
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: item.category.color }}
              />
              <span className="flex-1 text-slate-600">{item.category.name}</span>
              <span className="font-semibold">{money(item.total)}</span>
            </li>
          ))}
        </ul>
      </article>
      {type === "EXPENSE" && (
        <article className="rounded-3xl bg-white p-6">
          <h2 className="font-semibold">Gastos no período</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={originData}>
              <XAxis dataKey="name" tickLine={false} axisLine={false} />
              <Bar dataKey="total" fill="#163300" radius={10} />
              <Tooltip formatter={(value) => money(Number(value ?? 0))} />
            </BarChart>
          </ResponsiveContainer>
        </article>
      )}
    </section>
  );
}
