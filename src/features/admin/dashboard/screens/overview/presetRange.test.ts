import { describe, expect, it } from "vitest";
import { presetRange, previousRange } from "./OverviewScreen";

/**
 * The dashboard period presets. Month arithmetic is the part worth a test:
 * "last month" on 3 January is December of the PREVIOUS year, and the end of a
 * month is not a constant.
 */
describe("presetRange", () => {
  it("this month runs from the 1st to today", () => {
    expect(presetRange("this_month", "2026-07-31")).toEqual({ from: "2026-07-01", to: "2026-07-31" });
  });

  it("last month covers the whole previous month", () => {
    expect(presetRange("last_month", "2026-07-15")).toEqual({ from: "2026-06-01", to: "2026-06-30" });
    // 31-day month, so a hardcoded 30 would drop a day of collections.
    expect(presetRange("last_month", "2026-06-15")).toEqual({ from: "2026-05-01", to: "2026-05-31" });
    // February, in a leap year and out of one.
    expect(presetRange("last_month", "2024-03-10")).toEqual({ from: "2024-02-01", to: "2024-02-29" });
    expect(presetRange("last_month", "2026-03-10")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });

  it("rolls back across the year boundary", () => {
    expect(presetRange("last_month", "2026-01-03")).toEqual({ from: "2025-12-01", to: "2025-12-31" });
  });

  it("this year starts on 1 January", () => {
    expect(presetRange("this_year", "2026-07-31")).toEqual({ from: "2026-01-01", to: "2026-07-31" });
  });

  it("last 30 days ends today", () => {
    expect(presetRange("last_30", "2026-07-31").to).toBe("2026-07-31");
    expect(presetRange("last_30", "2026-07-31").from).toBe("2026-07-01");
  });
});

/**
 * The period-over-period baseline (SRA A-1 item 8). The invariant that matters
 * is EQUAL LENGTH and NO OVERLAP: a shorter baseline manufactures a growth
 * figure a head teacher would act on.
 */
describe("previousRange", () => {
  const days = (from: string, to: string) =>
    Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000) + 1;

  it("ends the day before the window starts", () => {
    expect(previousRange("2026-07-01", "2026-07-31").to).toBe("2026-06-30");
  });

  it("is the same length as the window it compares against", () => {
    for (const [from, to] of [
      ["2026-07-01", "2026-07-31"], // 31 days
      ["2026-02-01", "2026-02-28"], // 28
      ["2024-02-01", "2024-02-29"], // leap
      ["2026-07-15", "2026-07-15"], // one day
      ["2026-01-01", "2026-07-31"], // year-to-date, crossing no boundary
    ] as const) {
      const prev = previousRange(from, to);
      expect(days(prev.from, prev.to)).toBe(days(from, to));
      // No overlap: the baseline must end strictly before the window opens.
      expect(prev.to < from).toBe(true);
    }
  });

  it("rolls back across the year boundary", () => {
    expect(previousRange("2026-01-01", "2026-01-31")).toEqual({ from: "2025-12-01", to: "2025-12-31" });
  });

  it("a single day compares against the day before", () => {
    expect(previousRange("2026-03-01", "2026-03-01")).toEqual({ from: "2026-02-28", to: "2026-02-28" });
  });
});
