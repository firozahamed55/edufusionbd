// Supabase data access for the Exam module. RLS-scoped; writes via
// fn_upsert_exam / fn_save_marks / fn_process_exam_result / fn_save_exam_config.
import type { BrowserClient, RpcPayload } from "@/shared/services/supabase/types";
import { MAX_OPTIONS } from "@/shared/services/supabase/paging";

const s = (v: unknown) => (v == null ? "" : String(v));

/* --------------------------------------------------------------- exams */

export type ExamRow = { id: string; name: string; type: string | null; status: string; start_date: string | null; end_date: string | null };
// Year-scoped (audit A-M16): see shared/services/academicYear/api.ts.
export async function fetchExams(supabase: BrowserClient, yearId: string): Promise<ExamRow[]> {
  const { data, error } = await supabase.from("exam").select("id, name, type, status, start_date, end_date").eq("academic_year_id", yearId).order("created_at", { ascending: false }).limit(MAX_OPTIONS);
  if (error) throw error;
  return (data ?? []);
}

export type ExamPayload = { id?: string; name: string; type?: string; grade_scheme_id?: string; start_date?: string; end_date?: string; status?: string };
export async function upsertExam(supabase: BrowserClient, payload: ExamPayload): Promise<string> {
  const { data, error } = await supabase.rpc("fn_upsert_exam", { payload });
  if (error) throw new Error(error.message);
  return (data as string) ?? "";
}

export type GradeSchemeOption = { id: string; name: string; is_default: boolean };
export async function fetchGradeSchemes(supabase: BrowserClient): Promise<GradeSchemeOption[]> {
  const { data, error } = await supabase.from("grade_scheme").select("id, name, is_default").is("deleted_at", null).order("name").limit(MAX_OPTIONS);
  if (error) throw error;
  return (data ?? []);
}

/* --------------------------------------------------------------- marks */

export async function fetchSectionClassId(supabase: BrowserClient, sectionId: string): Promise<string | null> {
  const { data, error } = await supabase.from("class_section").select("class_id").eq("id", sectionId).maybeSingle();
  if (error) throw error;
  return (data as { class_id: string } | null)?.class_id ?? null;
}

/** Existing marks for a (exam, class, subject) keyed by student_id. */
export async function fetchExistingMarks(
  supabase: BrowserClient, examId: string, classId: string, subjectId: string,
): Promise<Record<string, { marks: string; absent: boolean }>> {
  const { data, error } = await supabase
    .from("mark")
    .select("student_id, marks_obtained, is_absent, exam_subject:exam_subject_id!inner(exam_id, class_id, subject_id)")
    .eq("exam_subject.exam_id", examId).eq("exam_subject.class_id", classId).eq("exam_subject.subject_id", subjectId).limit(MAX_OPTIONS);
  if (error) throw error;
  const map: Record<string, { marks: string; absent: boolean }> = {};
  for (const r of (data ?? [])) {
    map[r.student_id] = { marks: r.marks_obtained == null ? "" : String(r.marks_obtained), absent: r.is_absent };
  }
  return map;
}

export type SaveMarksPayload = {
  exam_id: string; class_section_id: string; subject_id: string; full_marks?: string;
  entries: { student_id: string; marks_obtained: string; is_absent: boolean }[];
};
export async function saveMarks(supabase: BrowserClient, payload: SaveMarksPayload): Promise<number> {
  const { data, error } = await supabase.rpc("fn_save_marks", { payload });
  if (error) throw new Error(error.message);
  return (data as number) ?? 0;
}

export async function processExamResult(supabase: BrowserClient, examId: string): Promise<void> {
  const { error } = await supabase.rpc("fn_process_exam_result", { p_exam_id: examId });
  if (error) throw new Error(error.message);
}

/* --------------------------------------------------------------- results */

export type ExamResultRow = { code: string | null; roll: number | null; name_bn: string; name_en: string; total: number | null; gpa: number | null; grade: string | null; merit: number | null; result: string | null; status: string };
export async function fetchExamResults(supabase: BrowserClient, examId: string, classSectionId?: string | null): Promise<ExamResultRow[]> {
  const { data, error } = await supabase
    .from("exam_result")
    .select("total_marks, gpa, grade, merit_rank, result, status, student:student_id(student_code, name_bn, name_en, enr:current_enrollment_id(class_section_id, roll_no))")
    .eq("exam_id", examId).order("merit_rank", { ascending: true }).limit(MAX_OPTIONS);
  if (error) throw error;
  let rows = (data ?? []);
  if (classSectionId) rows = rows.filter((r) => r.student?.enr?.class_section_id === classSectionId);
  return rows.map((r) => ({
    code: r.student?.student_code ?? null, roll: r.student?.enr?.roll_no ?? null,
    name_bn: r.student?.name_bn ?? "", name_en: r.student?.name_en ?? "",
    total: r.total_marks, gpa: r.gpa, grade: r.grade, merit: r.merit_rank, result: r.result, status: r.status,
  }));
}

/**
 * Per-subject full/pass marks (SRA A-5.1 item 1).
 *
 * The Marks Entry grid used a free-text "Full marks" input defaulting to the
 * string "100", and consulted neither the subject's own configured marks nor
 * `mark_config` — the screen that exists to configure exactly this. An operator
 * entering 100 for a subject configured at 50 produced a wrong GPA for the whole
 * section, with nothing anywhere to catch it.
 */
export type SubjectMarks = { full_marks: number | null; pass_marks: number | null };
export async function fetchSubjectMarks(
  supabase: BrowserClient,
  subjectId: string,
): Promise<SubjectMarks> {
  const { data, error } = await supabase
    .from("subject")
    .select("full_marks, pass_marks")
    .eq("id", subjectId)
    .maybeSingle();
  if (error) throw error;
  return { full_marks: data?.full_marks ?? null, pass_marks: data?.pass_marks ?? null };
}

/* --------------------------------------------------------------- config */

export async function fetchExamConfig(supabase: BrowserClient, kind: "mark" | "comment" | "marksheet" | "date"): Promise<RpcPayload> {
  const table = ({ mark: "mark_config", comment: "comment_config", marksheet: "marksheet_config", date: "exam_date_config" } as const)[kind];
  const { data, error } = await supabase.from(table).select("config").limit(1).maybeSingle();
  if (error) throw error;
  return ((data as { config: RpcPayload } | null)?.config ?? {}) as RpcPayload;
}

export async function saveExamConfig(supabase: BrowserClient, kind: "mark" | "comment" | "marksheet" | "date", config: RpcPayload): Promise<void> {
  const { error } = await supabase.rpc("fn_save_exam_config", { p_kind: kind, payload: config });
  if (error) throw new Error(error.message);
}

export const asStr = s;
