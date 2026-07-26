/**
 * The current academic year — audit A-M16.
 *
 * THE BUG THIS PREVENTS. Seven tables are year-scoped (`academic_year`,
 * `class_section`, `exam`, `fee_invoice`, `migration_batch`,
 * `student_enrollment`, `timetable_period`) and, before this module existed,
 * **not one query filtered on the year**. That works while a tenant has one
 * year of data and then stops working silently: in year two every section
 * dropdown lists both years' sections, the exam picker doubles, and fee reports
 * blend two years with no error and no visual cue. It gets discovered by a
 * school, in production, at rollover — which is a data-correctness incident,
 * not a refactor.
 *
 * `academic_year` already carries `uq_year_current ... where is_current`, so
 * "the current year" is a database-enforced singleton per institution. This is
 * the one place that reads it.
 *
 * The year is now also SELECTABLE (audit T-1/B-1 — it was resolved implicitly by
 * 21 files and displayed nowhere, so an operator could not see or choose which
 * year they were writing to). `AcademicYearProvider` overrides the selection;
 * this query remains the default and the definition of "current".
 */
import type { BrowserClient } from "@/shared/services/supabase/types";
import { MAX_OPTIONS } from "@/shared/services/supabase/paging";

export type AcademicYear = { id: string; year_label: string; is_current?: boolean };

export async function fetchCurrentYear(supabase: BrowserClient): Promise<AcademicYear | null> {
  const { data, error } = await supabase
    .from("academic_year")
    .select("id, year_label")
    .eq("is_current", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

/** Every year the institution has, newest first — feeds the topbar switcher. */
export async function fetchAcademicYears(supabase: BrowserClient): Promise<AcademicYear[]> {
  const { data, error } = await supabase
    .from("academic_year")
    .select("id, year_label, is_current")
    .is("deleted_at", null)
    .order("year_label", { ascending: false })
    .limit(MAX_OPTIONS);
  if (error) throw error;
  return data ?? [];
}
