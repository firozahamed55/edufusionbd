// Supabase data access for the Attendance module. RLS-scoped; marking goes
// through the transaction-safe fn_mark_attendance RPC; reports via fn_attendance_summary.
import type { BrowserClient } from "@/shared/services/supabase/types";
import { MAX_OPTIONS } from "@/shared/services/supabase/paging";


export type ExamOption = { id: string; name: string };
// Year-scoped (audit A-M16): see shared/services/academicYear/api.ts.
export async function fetchExams(supabase: BrowserClient, yearId: string): Promise<ExamOption[]> {
  const { data, error } = await supabase.from("exam").select("id, name").eq("academic_year_id", yearId).order("created_at", { ascending: false }).limit(MAX_OPTIONS);
  if (error) throw error;
  return (data ?? []);
}

/** Existing statuses for a (section, date, context[, exam]) keyed by student_id. */
export async function fetchSectionAttendance(
  supabase: BrowserClient,
  classSectionId: string,
  attDate: string,
  context: "daily" | "exam",
  examId?: string | null,
): Promise<ExistingAttendance> {
  let q = supabase
    .from("attendance")
    .select("student_id, status, created_at, marked_by, marker:marked_by(full_name)")
    .eq("class_section_id", classSectionId)
    .eq("att_date", attDate)
    .eq("context", context)
    .limit(MAX_OPTIONS);
  q = examId ? q.eq("exam_id", examId) : q.is("exam_id", null);
  const { data, error } = await q;
  if (error) throw error;

  const statuses: Record<string, string> = {};
  let takenAt: string | null = null;
  let takenBy: string | null = null;
  for (const r of data ?? []) {
    statuses[r.student_id] = r.status;
    // Earliest row wins: that is when the register was actually taken, not when
    // it was last corrected.
    if (!takenAt || r.created_at < takenAt) {
      takenAt = r.created_at;
      takenBy = r.marker?.full_name ?? null;
    }
  }
  return { statuses, takenAt, takenBy, count: Object.keys(statuses).length };
}

/**
 * Existing marks PLUS the provenance the screen needs to warn (SRA A-4 item 2).
 *
 * Marks used to hydrate silently, so the operator could not tell "I am creating
 * today's record" from "I am overwriting it" — on a screen whose Save sends real
 * SMS to guardians and spends the school's balance.
 */
export type ExistingAttendance = {
  statuses: Record<string, string>;
  takenAt: string | null;
  takenBy: string | null;
  count: number;
};

export type MarkAttendancePayload = {
  class_section_id: string;
  att_date: string;
  context: "daily" | "exam";
  exam_id?: string;
  sms?: boolean;
  entries: { student_id: string; status: string }[];
};
export async function markAttendance(supabase: BrowserClient, payload: MarkAttendancePayload): Promise<number> {
  const { data, error } = await supabase.rpc("fn_mark_attendance", { payload });
  if (error) throw new Error(error.message);
  return (data as number) ?? 0;
}

export type AttendanceSummary = {
  working_days: number;
  total_students: number;
  avg_rate: number;
  regular_count: number;
  at_risk_count: number;
  status_split: { present: number; late: number; absent: number; leave: number; exam_absent: number };
  students: { code: string | null; roll: number | null; name_bn: string; name_en: string; present: number; total: number; rate: number }[];
  at_risk: { code: string | null; roll: number | null; name_bn: string; name_en: string; rate: number; absent: number }[];
};
export async function fetchAttendanceSummary(
  supabase: BrowserClient,
  classSectionId: string | null,
  from: string,
  to: string,
): Promise<AttendanceSummary> {
  // `useAttendanceSummary` gates on `enabled`, so a null section id means the
  // caller fired anyway. Fail loudly instead of asking Postgres to summarise
  // the null section and rendering the empty result as "0% attendance".
  if (!classSectionId) throw new Error("fetchAttendanceSummary: no class section selected");
  const { data, error } = await supabase.rpc("fn_attendance_summary", { p_class_section_id: classSectionId, p_from: from, p_to: to });
  if (error) throw new Error(error.message);
  return data as AttendanceSummary;
}
