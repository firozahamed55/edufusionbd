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
