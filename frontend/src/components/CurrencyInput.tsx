import { cn } from "../lib/cn";

const format = (digits: string): string =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(digits || "0") / 100,
  );

export const toCents = (value: string | number | undefined): string =>
  Math.round(Number(value ?? 0) * 100).toString();

export const fromCents = (digits: string): number => Number(digits || "0") / 100;

interface CurrencyInputProps {
  label: string;
  cents: string;
  className?: string;
  onChange: (cents: string) => void;
}

/** Máscara por centavos: guarda só os dígitos e reformata a cada tecla. */
export function CurrencyInput({ label, cents, className, onChange }: CurrencyInputProps) {
  return (
    <input
      className={cn(className)}
      aria-label={label}
      inputMode="numeric"
      value={format(cents)}
      onChange={(event) => onChange(event.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, ""))}
    />
  );
}
