import { describe, it, expect, vi } from "vitest";
import { fetchAuditLog, isDay, isRecordId } from "./api";
import type { BrowserClient } from "@/shared/services/supabase/types";

/**
 * Settings audit M-14 / S-11.1 — Phase 1.3 QA: the date filter's bounds.
 *
 * WHY THIS IS WORTH A TEST AT ALL. `audit_log.at` is a timestamptz and the
 * filter's input is a day. The obvious implementation — `lte('at', to)` —
 * parses `2026-04-30` as midnight and silently drops everything that happened
 * on the last day of the range. The operator sees a shorter list, not an
 * error, and concludes the log is missing rows. A fake query builder records
 * the calls so the boundary is asserted rather than assumed.
 */

type Call = [string, string];

function fakeClient(calls: Call[]) {
  const builder = {
    select: () => builder,
    order: () => builder,
    range: () => builder,
    eq: (col: string, value: string) => { calls.push(["eq", `${col}=${value}`]); return builder; },
    gte: (col: string, value: string) => { calls.push(["gte", `${col}=${value}`]); return builder; },
    lt: (col: string, value: string) => { calls.push(["lt", `${col}=${value}`]); return builder; },
    then: undefined,
  } as unknown as Record<string, unknown>;
  // `await query` at the end of fetchAuditLog resolves this thenable.
  (builder as { then: unknown }).then = (resolve: (v: unknown) => void) =>
    resolve({ data: [], error: null, count: 0 });
  return { from: vi.fn(() => builder) } as unknown as BrowserClient;
}

describe("fetchAuditLog date bounds", () => {
  it("includes the whole of the last day — `< to + 1 day`, never `<= to`", async () => {
    const calls: Call[] = [];
    await fetchAuditLog(fakeClient(calls), { from: "2026-04-01", to: "2026-04-30" });
    expect(calls).toContainEqual(["gte", "at=2026-04-01T00:00:00"]);
    expect(calls).toContainEqual(["lt", "at=2026-05-01T00:00:00"]);
  });

  it("rolls the upper bound over a month end and a year end correctly", async () => {
    const calls: Call[] = [];
    await fetchAuditLog(fakeClient(calls), { to: "2026-12-31" });
    expect(calls).toContainEqual(["lt", "at=2027-01-01T00:00:00"]);
  });

  it("ignores a malformed date instead of sending PostgREST a 400", async () => {
    const calls: Call[] = [];
    await fetchAuditLog(fakeClient(calls), { from: "last tuesday", to: "" });
    expect(calls.filter(([kind]) => kind === "gte" || kind === "lt")).toEqual([]);
  });

  it("filters by actor only when the value is a real uuid", async () => {
    const calls: Call[] = [];
    await fetchAuditLog(fakeClient(calls), { changedBy: "3f2504e0-4f89-11d3-9a0c-0305e82c3301" });
    expect(calls).toContainEqual(["eq", "changed_by=3f2504e0-4f89-11d3-9a0c-0305e82c3301"]);

    const bad: Call[] = [];
    await fetchAuditLog(fakeClient(bad), { changedBy: "someone" });
    expect(bad).toEqual([]);
  });

  it("applies entity and action filters alongside the range", async () => {
    const calls: Call[] = [];
    await fetchAuditLog(fakeClient(calls), { entity: "student", action: "UPDATE", from: "2026-04-01" });
    expect(calls).toContainEqual(["eq", "entity=student"]);
    expect(calls).toContainEqual(["eq", "action=UPDATE"]);
    expect(calls).toContainEqual(["gte", "at=2026-04-01T00:00:00"]);
  });
});

describe("input guards", () => {
  it("isDay accepts only YYYY-MM-DD", () => {
    expect(isDay("2026-04-01")).toBe(true);
    expect(isDay("2026-4-1")).toBe(false);
    expect(isDay("")).toBe(false);
  });

  it("isRecordId accepts only a uuid", () => {
    expect(isRecordId("3f2504e0-4f89-11d3-9a0c-0305e82c3301")).toBe(true);
    expect(isRecordId("3f2504e0")).toBe(false);
  });
});
