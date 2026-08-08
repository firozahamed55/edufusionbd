/**
 * Academic calendar data access (SRA A-4 item 3 · portfolio addition #7).
 *
 * `academic_calendar` and `academic_term` both existed as tables with no
 * writer and no reader. This is both.
 */
import type { BrowserClient } from "@/shared/services/supabase/types";
import { MAX_OPTIONS } from "@/shared/services/supabase/paging";

export type CalendarDay = { date: string; working: boolean; label: string | null };

export type DayStatus = CalendarDay & { source: "calendar" | "weekend" | "default" };

export async function fetchCalendarRange(s: BrowserClient, from: string, to: string): Promise<CalendarDay[]> {
  const { data, error } = await s.rpc("fn_calendar_range", { p_from: from, p_to: to });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    date: String(r.date),
    working: !!r.working,
    label: r.label == null ? null : String(r.label),
  }));
}

/** Is this a teaching day — the question the attendance screen asks. */
export async function fetchDayStatus(s: BrowserClient, date: string): Promise<DayStatus> {
  const { data, error } = await s.rpc("fn_calendar_day", { p_date: date });
  if (error) throw new Error(error.message);
  const r = (data ?? {}) as Record<string, unknown>;
  return {
    date: String(r.date ?? date),
    working: r.working !== false,
    label: r.label == null ? null : String(r.label),
    source: (r.source as DayStatus["source"]) ?? "default",
  };
}

export async function setCalendarRange(
  s: BrowserClient,
  payload: { from: string; to?: string; is_working_day: boolean; label?: string; academic_year_id?: string },
): Promise<number> {
  const { data, error } = await s.rpc("fn_set_calendar_range", { payload });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

export async function clearCalendarRange(s: BrowserClient, from: string, to: string): Promise<number> {
  const { data, error } = await s.rpc("fn_clear_calendar_range", { p_from: from, p_to: to });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

/* ----------------------------------------------------------------- terms */

export type TermRow = {
  id: string;
  name_en: string;
  name_bn: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
};

export async function fetchTerms(s: BrowserClient, yearId: string): Promise<TermRow[]> {
  const { data, error } = await s
    .from("academic_term")
    .select("id, name_en, name_bn, start_date, end_date, is_current")
    .eq("academic_year_id", yearId)
    .order("start_date", { ascending: true, nullsFirst: false })
    .limit(MAX_OPTIONS);
  if (error) throw error;
  return (data ?? []);
}

export async function upsertTerm(
  s: BrowserClient,
  payload: {
    id?: string; academic_year_id: string; name_en: string; name_bn?: string;
    start_date?: string; end_date?: string; is_current?: boolean;
  },
): Promise<string> {
  const { data, error } = await s.rpc("fn_upsert_academic_term", { payload });
  if (error) throw new Error(error.message);
  return (data as string) ?? "";
}

export async function deleteTerm(s: BrowserClient, id: string): Promise<void> {
  const { error } = await s.rpc("fn_delete_academic_term", { p_id: id });
  if (error) throw new Error(error.message);
}

/* ------------------------------------------------------------- calendar grid */

/** Days of one month, padded to whole weeks starting Saturday — the
 *  Bangladeshi school week, not the Monday- or Sunday-first one a generic
 *  calendar component assumes. */
export function monthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  // JS: 0 = Sunday. Saturday-first means Saturday maps to column 0.
  const lead = (first.getUTCDay() + 1) % 7;
  const cells: (string | null)[] = Array<string | null>(lead).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/**
 * Where a keystroke moves the focused date (audit A-3, WCAG 2.1.1).
 *
 * The month grid was 42 `<button>`s in a `<div>`, reachable only by Tab — so
 * reaching 28 April cost 28 Tab presses, and there was no way to leave the
 * month by keyboard at all. This is the movement half of the fix.
 *
 * It is DATE arithmetic, not cell arithmetic. Right at the end of a row lands
 * on the next day, which is the first cell of the next row, and Right on the
 * last day of the month lands on the first of the next one — the operator is
 * moving through a year, not around a 7×6 rectangle. That is also why this
 * lives here rather than in `shared/lib/useGridNavigation`, which is built for
 * grids of inputs where Tab already means the right thing and deliberately
 * does not take it over.
 *
 * Returns the target ISO date, or null when the key is not ours to handle.
 */
export function calendarKeyTarget(key: string, iso: string): string | null {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  const shift = (days: number) => {
    const next = new Date(d.getTime() + days * 86_400_000);
    return next.toISOString().slice(0, 10);
  };
  const shiftMonths = (months: number) => {
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + months;
    // Clamp the day: 31 March + 1 month is 30 April, not 1 May.
    const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const day = Math.min(d.getUTCDate(), lastDay);
    return new Date(Date.UTC(y, m, day)).toISOString().slice(0, 10);
  };

  switch (key) {
    case "ArrowRight": return shift(1);
    case "ArrowLeft": return shift(-1);
    case "ArrowDown": return shift(7);
    case "ArrowUp": return shift(-7);
    // Saturday-first week, matching `monthGrid`: Saturday is column 0.
    case "Home": return shift(-((d.getUTCDay() + 1) % 7));
    case "End": return shift(6 - ((d.getUTCDay() + 1) % 7));
    case "PageUp": return shiftMonths(-1);
    case "PageDown": return shiftMonths(1);
    default: return null;
  }
}
