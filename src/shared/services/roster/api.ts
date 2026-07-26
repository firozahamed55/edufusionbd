// Shared "students in a section" roster — reused by Student, Fee, Attendance and
// Exam modules (single source of truth). RLS-scoped to the caller's institution.
import type { BrowserClient } from "@/shared/services/supabase/types";
import { MAX_OPTIONS } from "@/shared/services/supabase/paging";

export type SectionStudent = {
  enrollmentId: string;
  studentId: string;
  code: string | null;
  roll: number | null;
  name_bn: string;
  name_en: string;
  category: string | null;
};

export type StudentLite = { id: string; code: string | null; name_bn: string; name_en: string };

/** Look up a student by student_code (returns null if not found). */
export async function findStudentByCode(supabase: BrowserClient, code: string): Promise<StudentLite | null> {
  const { data, error } = await supabase
    .from("student")
    .select("id, student_code, name_bn, name_en")
    .eq("student_code", code)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { id: data.id, code: data.student_code, name_bn: data.name_bn, name_en: data.name_en };
}

export async function fetchSectionStudents(
  supabase: BrowserClient,
  classSectionId: string,
): Promise<SectionStudent[]> {
  const { data, error } = await supabase
    .from("student_enrollment")
    .select(
      "id, roll_no, student:student_id(id, student_code, name_bn, name_en, category:student_category_id(name))",
    )
    .eq("class_section_id", classSectionId)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("roll_no", { ascending: true }).limit(MAX_OPTIONS);
  if (error) throw error;

  return (data ?? []).map((r) => ({
    enrollmentId: r.id,
    studentId: r.student?.id ?? "",
    code: r.student?.student_code ?? null,
    roll: r.roll_no,
    name_bn: r.student?.name_bn ?? "",
    name_en: r.student?.name_en ?? "",
    category: r.student?.category?.name ?? null,
  }));
}
