// Supabase data access for the Attendance module. RLS-scoped; marking goes
// through the transaction-safe fn_mark_attendance RPC; reports via fn_attendance_summary.
import type { BrowserClient } from "@/shared/services/supabase/types";

type RpcFn = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;

export type ExamOption = { id: string; name: string };
export async function fetchExams(supabase: BrowserClient): Promise<ExamOption[]> {
  const { data, error } = await supabase.from("exam").select("id, name").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ExamOption[];
}

/** Existing statuses for a (section, date, context[, exam]) keyed by student_id. */
export async function fetchSectionAttendance(
  supabase: BrowserClient,
  classSectionId: string,
  attDate: string,
  context: "daily" | "exam",
  examId?: string | null,
): Promise<Record<string, string>> {
  let q = supabase.from("attendance").select("student_id, status").eq("class_section_id", classSectionId).eq("att_date", attDate).eq("context", context);
  q = examId ? q.eq("exam_id", examId) : q.is("exam_id", null);
  const { data, error } = await q;
  if (error) throw error;
  const map: Record<string, string> = {};
  for (const r of (data ?? []) as unknown as { student_id: string; status: string }[]) map[r.student_id] = r.status;
  return map;
}

export type MarkAttendancePayload = {
  class_section_id: string;
  att_date: string;
  context: "daily" | "exam";
  exam_id?: string;
  sms?: boolean;
  entries: { student_id: string; status: string }[];
};
export async function markAttendance(supabase: BrowserClient, payload: MarkAttendancePayload): Promise<number> {
  const rpc: RpcFn = (fn, args) => (supabase as unknown as { rpc: RpcFn }).rpc(fn, args);
  const { data, error } = await rpc("fn_mark_attendance", { payload });
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
  const rpc: RpcFn = (fn, args) => (supabase as unknown as { rpc: RpcFn }).rpc(fn, args);
  const { data, error } = await rpc("fn_attendance_summary", { p_class_section_id: classSectionId, p_from: from, p_to: to });
  if (error) throw new Error(error.message);
  return data as AttendanceSummary;
}
