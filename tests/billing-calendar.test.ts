import { describe, expect, it } from "vitest";
import {
  addMonthsKeepingDay,
  clampedDate,
  invoiceForDate,
  invoicePeriod,
  shiftInvoiceRef,
} from "../src/lib/billing-calendar";

const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);
const iso = (date: Date): string => date.toISOString().slice(0, 10);

describe("calendário da fatura", () => {
  it("fecha 25 e vence 5: compra em 10/03/2026 vence em 05/04", () => {
    const period = invoiceForDate({ closingDay: 25, dueDay: 5 }, day("2026-03-10"));
    expect(iso(period.closingDate)).toBe("2026-03-25");
    expect(iso(period.dueDate)).toBe("2026-04-05");
    expect(period.ref).toEqual({ year: 2026, month: 4 });
    expect(iso(period.start)).toBe("2026-02-25");
  });

  it("compra no dia do fechamento vai para a fatura seguinte", () => {
    const period = invoiceForDate({ closingDay: 25, dueDay: 5 }, day("2026-03-25"));
    expect(iso(period.closingDate)).toBe("2026-04-25");
    expect(iso(period.dueDate)).toBe("2026-05-05");
  });

  it("fecha 20 e vence 28: compra em 01/03/2026 vence em 28/03", () => {
    const period = invoiceForDate({ closingDay: 20, dueDay: 28 }, day("2026-03-01"));
    expect(iso(period.closingDate)).toBe("2026-03-20");
    expect(iso(period.dueDate)).toBe("2026-03-28");
    expect(period.ref).toEqual({ year: 2026, month: 3 });
  });

  it("fechamento no dia 31 usa o último dia de fevereiro", () => {
    const card = { closingDay: 31, dueDay: 10 };
    expect(iso(invoiceForDate(card, day("2026-02-10")).closingDate)).toBe("2026-02-28");
    expect(iso(invoiceForDate(card, day("2028-02-10")).closingDate)).toBe("2028-02-29");
  });

  it("vira o ano: fecha 25, vence 5, compra em 28/12/2026 vence em 05/02/2027", () => {
    const period = invoiceForDate({ closingDay: 25, dueDay: 5 }, day("2026-12-28"));
    expect(iso(period.dueDate)).toBe("2027-02-05");
    expect(period.ref).toEqual({ year: 2027, month: 2 });
  });

  it("addMonthsKeepingDay parte sempre da data original", () => {
    expect(iso(addMonthsKeepingDay(day("2026-01-31"), 1))).toBe("2026-02-28");
    expect(iso(addMonthsKeepingDay(day("2026-01-31"), 2))).toBe("2026-03-31");
    expect(iso(addMonthsKeepingDay(day("2028-01-31"), 1))).toBe("2028-02-29");
    expect(iso(addMonthsKeepingDay(day("2026-11-15"), 3))).toBe("2027-02-15");
  });

  it("clampedDate e shiftInvoiceRef", () => {
    expect(iso(clampedDate(2026, 4, 31))).toBe("2026-04-30");
    expect(shiftInvoiceRef({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftInvoiceRef({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
  });

  it("toda data cai no período da própria fatura e os períodos são contíguos", () => {
    const days = [1, 5, 15, 28, 29, 30, 31];
    for (const closingDay of days) {
      for (const dueDay of days) {
        if (closingDay === dueDay) continue;
        const card = { closingDay, dueDay };
        for (
          let d = day("2026-01-01");
          d < day("2029-01-01");
          d = new Date(d.getTime() + 86_400_000)
        ) {
          const period = invoiceForDate(card, d);
          const again = invoicePeriod(card, period.ref);
          expect(again).toEqual(period);
          expect(
            period.start <= d && d < period.closingDate,
            `${closingDay}/${dueDay} ${iso(d)}`,
          ).toBe(true);
        }
        for (let m = 0; m < 36; m += 1) {
          const ref = shiftInvoiceRef({ year: 2026, month: 1 }, m);
          const current = invoicePeriod(card, ref);
          const next = invoicePeriod(card, shiftInvoiceRef(ref, 1));
          expect(current.closingDate.getTime(), `${closingDay}/${dueDay} ${m}`).toBe(
            next.start.getTime(),
          );
        }
      }
    }
  });
});
