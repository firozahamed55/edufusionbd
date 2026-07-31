import { describe, expect, it } from "vitest";
import { localDay, dayOffset, formatDate, formatDateTime, weekdayShort } from "./format";

// The bug this file exists to prevent: 2026-07-31T18:30:00Z is 2026-08-01
// 00:30 in Dhaka. `toISOString().slice(0,10)` reports "2026-07-31" — a whole
// day wrong for every event logged after 18:00 local.
const AFTER_LOCAL_MIDNIGHT = "2026-07-31T18:30:00.000Z";

describe("format", () => {
  it("reports the institution day, not the UTC day", () => {
    expect(localDay(AFTER_LOCAL_MIDNIGHT)).toBe("2026-08-01");
    expect(new Date(AFTER_LOCAL_MIDNIGHT).toISOString().slice(0, 10)).toBe("2026-07-31");
  });

  it("offsets days in institution time", () => {
    expect(dayOffset(-1, AFTER_LOCAL_MIDNIGHT)).toBe("2026-07-31");
    expect(dayOffset(1, AFTER_LOCAL_MIDNIGHT)).toBe("2026-08-02");
  });

  it("formats a date and a datetime in institution time", () => {
    expect(formatDate(AFTER_LOCAL_MIDNIGHT)).toBe("01 Aug 2026");
    expect(formatDateTime(AFTER_LOCAL_MIDNIGHT)).toBe("01 Aug 2026, 00:30");
  });

  it("returns empty string for absent or unparseable input", () => {
    expect(formatDate(null)).toBe("");
    expect(formatDate("")).toBe("");
    expect(formatDateTime(undefined)).toBe("");
    expect(formatDate("not a date")).toBe("");
  });

  it("labels weekdays in institution time", () => {
    expect(weekdayShort(AFTER_LOCAL_MIDNIGHT)).toBe("Sat");
  });
});
