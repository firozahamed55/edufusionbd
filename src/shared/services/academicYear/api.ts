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
 * ponytail: no year *switcher* yet — every screen scopes to the current year.
 * When looking at a past year becomes a requirement, replace `useCurrentYear`'s
 * internals with a context whose default is this query; the ~10 call sites
 * already take the id as a parameter and will not need to change.
 */
import type { BrowserClient } from "@/shared/services/supabase/types";

export type AcademicYear = { id: string; year_label: string };

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
