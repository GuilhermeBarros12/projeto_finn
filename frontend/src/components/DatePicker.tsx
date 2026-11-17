import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../lib/cn";
import {
  MONTHS,
  WEEKDAYS,
  addDays,
  formatLongDate,
  formatSpokenDate,
  monthGrid,
} from "../lib/calendar";
import { todayInput } from "../lib/format";

const inputClass =
  "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-finn-forest focus:bg-white focus:ring-4 focus:ring-finn-lime/30";

const MIN_YEAR = 2000;
const MAX_YEAR = 2100;
const YEARS = Array.from({ length: MAX_YEAR - MIN_YEAR + 1 }, (_, index) => MIN_YEAR + index);

const viewOf = (isoDate: string) => {
  const [year, month] = isoDate.split("-").map(Number) as [number, number];
  return { year, month };
};

interface DatePickerProps {
  name: string; // vira um <input type="hidden"> para o FormData continuar funcionando
  label: string; // aria-label do botão
  value: string; // AAAA-MM-DD
  onChange: (value: string) => void;
  min?: string | undefined;
  disabled?: boolean | undefined;
}

export function DatePicker({ name, label, value, onChange, min, disabled }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => viewOf(value));
  const [focused, setFocused] = useState(value);
  const root = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const dialogId = useId();
  const today = todayInput();

  // Clique fora fecha o calendário.
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  // Leva o foco do teclado ao dia atual da navegação.
  useEffect(() => {
    if (!open) return;
    grid.current?.querySelector<HTMLButtonElement>(`[data-iso="${focused}"]`)?.focus();
  }, [open, focused, view]);

  const toggle = () => {
    if (!open) {
      setView(viewOf(value));
      setFocused(value);
    }
    setOpen(!open);
  };

  const shiftMonth = (months: number) => {
    const total = view.year * 12 + (view.month - 1) + months;
    const year = Math.floor(total / 12);
    if (year < MIN_YEAR || year > MAX_YEAR) return;
    setView({ year, month: (total % 12) + 1 });
  };

  const choose = (iso: string) => {
    if (min && iso < min) return;
    onChange(iso);
    setOpen(false);
  };

  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      setOpen(false);
      return;
    }

    const steps: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    const step = steps[event.key];
    if (step === undefined || !(event.target as HTMLElement).dataset.iso) return;

    event.preventDefault();
    const next = addDays(focused, step);
    setFocused(next);
    setView(viewOf(next));
  };

  const weeks = monthGrid(view.year, view.month);

  return (
    <div className="relative" ref={root}>
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        disabled={disabled}
        onClick={toggle}
        className={cn(
          inputClass,
          "flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        <span>{formatLongDate(value)}</span>
        <CalendarDays size={17} className="shrink-0 text-slate-400" />
      </button>
      {open && (
        <div
          id={dialogId}
          role="dialog"
          aria-label={`Calendário: ${label}`}
          onKeyDown={keyDown}
          className="absolute top-full left-0 z-50 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl"
        >
          <div className="mb-2 flex items-center gap-1">
            <button
              type="button"
              aria-label="Mês anterior"
              className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
              onClick={() => shiftMonth(-1)}
            >
              <ChevronLeft size={16} />
            </button>
            <select
              aria-label="Mês"
              className="min-w-0 flex-1 rounded-lg bg-slate-50 px-2 py-1.5 text-sm capitalize"
              value={view.month}
              onChange={(event) => setView({ ...view, month: Number(event.target.value) })}
            >
              {MONTHS.map((month, index) => (
                <option value={index + 1} key={month}>
                  {month}
                </option>
              ))}
            </select>
            <select
              aria-label="Ano"
              className="rounded-lg bg-slate-50 px-2 py-1.5 text-sm"
              value={view.year}
              onChange={(event) => setView({ ...view, year: Number(event.target.value) })}
            >
              {YEARS.map((year) => (
                <option value={year} key={year}>
                  {year}
                </option>
              ))}
            </select>
            <button
              type="button"
              aria-label="Próximo mês"
              className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
              onClick={() => shiftMonth(1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <div role="grid" aria-label="Dias do mês" ref={grid}>
            <div role="row" className="grid grid-cols-7 text-center text-xs text-slate-400">
              {WEEKDAYS.map((weekday) => (
                <span role="columnheader" key={weekday} className="py-1">
                  {weekday}
                </span>
              ))}
            </div>
            {weeks.map((week) => (
              <div role="row" className="grid grid-cols-7" key={week[0]?.iso}>
                {week.map((cell) => {
                  const selected = cell.iso === value;
                  return (
                    <div role="gridcell" key={cell.iso} className="grid place-items-center p-0.5">
                      <button
                        type="button"
                        data-iso={cell.iso}
                        aria-label={formatSpokenDate(cell.iso)}
                        aria-pressed={selected}
                        disabled={Boolean(min && cell.iso < min)}
                        tabIndex={cell.iso === focused ? 0 : -1}
                        onClick={() => choose(cell.iso)}
                        className={cn(
                          "h-9 w-9 rounded-full text-sm transition disabled:cursor-not-allowed disabled:opacity-30",
                          cell.inMonth ? "text-slate-800" : "text-slate-300",
                          !selected && "hover:bg-slate-100",
                          cell.iso === today && "ring-2 ring-finn-lime",
                          selected && "bg-finn-forest text-white hover:bg-finn-forest",
                        )}
                      >
                        {cell.day}
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
