import { describe, expect, it } from "vitest";
import { monthGrid } from "./calendar";

describe("monthGrid", () => {
  it("pads to whole weeks", () => {
    for (const [y, m] of [[2026, 0], [2026, 1], [2026, 4], [2024, 1]] as const) {
      expect(monthGrid(y, m).length % 7).toBe(0);
    }
  });

  it("contains every day of the month exactly once", () => {
    const cells = monthGrid(2026, 3); // April 2026, 30 days
    const days = cells.filter(Boolean) as string[];
    expect(days).toHaveLength(30);
    expect(days[0]).toBe("2026-04-01");
    expect(days[29]).toBe("2026-04-30");
    expect(new Set(days).size).toBe(30);
  });

  it("handles a leap February", () => {
    expect((monthGrid(2024, 1).filter(Boolean) as string[])).toHaveLength(29);
    expect((monthGrid(2026, 1).filter(Boolean) as string[])).toHaveLength(28);
  });

  /**
   * Saturday-first, because the Bangladeshi school week is Saturday–Thursday
   * with Friday the weekly holiday. A Monday- or Sunday-first grid puts the
   * weekend in the middle of the row, which is the sort of thing that makes an
   * operator mistrust the whole screen.
   *
   * 2026-04-01 is a Wednesday. Saturday=0 … Wednesday=4, so it lands in
   * column 4 and there are exactly 4 leading blanks.
   */
  it("starts the week on Saturday", () => {
    const cells = monthGrid(2026, 3);
    expect(cells.slice(0, 4).every((c) => c === null)).toBe(true);
    expect(cells[4]).toBe("2026-04-01");
    expect(new Date(`${cells[4]}T00:00:00Z`).getUTCDay()).toBe(3); // Wednesday
    // Every column-0 cell that holds a date must be a Saturday.
    for (let i = 0; i < cells.length; i += 7) {
      const cell = cells[i];
      if (cell) expect(new Date(`${cell}T00:00:00Z`).getUTCDay()).toBe(6);
    }
  });

  it("emits zero-padded ISO dates", () => {
    const cells = monthGrid(2026, 0).filter(Boolean) as string[];
    for (const c of cells) expect(c).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
