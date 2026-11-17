import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonthsKeepingDay,
  daysInMonth,
  formatLongDate,
  monthGrid,
  weekdayOf,
} from "./calendar";

describe("calendar", () => {
  it("monthGrid de fevereiro de 2026 começa no domingo 01/02", () => {
    const grid = monthGrid(2026, 2);

    expect(grid).toHaveLength(6);
    expect(grid.every((week) => week.length === 7)).toBe(true);
    expect(grid[0]?.[0]).toEqual({ iso: "2026-02-01", day: 1, inMonth: true });
    expect(grid[5]?.[6]?.inMonth).toBe(false);
  });

  it("marca os dias do mês anterior como fora do mês", () => {
    const first = monthGrid(2026, 12)[0];

    expect(first?.[0]).toEqual({ iso: "2026-11-29", day: 29, inMonth: false });
    expect(first?.find((cell) => cell.iso === "2026-12-01")?.inMonth).toBe(true);
  });

  it("conhece ano bissexto e dia da semana", () => {
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(weekdayOf("2026-11-16")).toBe(1);
  });

  it("addMonthsKeepingDay parte da data original", () => {
    expect(addMonthsKeepingDay("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsKeepingDay("2026-01-31", 2)).toBe("2026-03-31");
    expect(addMonthsKeepingDay("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonthsKeepingDay("2026-11-15", 3)).toBe("2027-02-15");
  });

  it("addDays atravessa meses e anos", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("formatLongDate mostra o dia da semana", () => {
    expect(formatLongDate("2026-11-16")).toBe("seg, 16/11/2026");
  });
});
