// Supabase data access for admin/teacher/list. RLS-scoped to the caller's institution.
import type { BrowserClient } from "@/shared/services/supabase/types";

export type TeacherRow = {
  id: string;
  name_bn: string;
  name_en: string;
  email: string | null;
  status: string;
  designation: string | null;
  subject_bn: string | null;
  subject_en: string | null;
  classTeacher: boolean;
};

export async function fetchTeachers(supabase: BrowserClient): Promise<TeacherRow[]> {
  const [teachersRes, csRes] = await Promise.all([
    supabase
      .from("teacher")
      .select(
        "id, name_bn, name_en, email, status, designation:designation_id(name), subject:main_subject_id(name_bn, name_en)",
      )
      .is("deleted_at", null)
      .order("employee_code", { ascending: true }),
    supabase.from("class_section").select("class_teacher_id").not("class_teacher_id", "is", null),
  ]);
  if (teachersRes.error) throw teachersRes.error;
  if (csRes.error) throw csRes.error;

  const csRows = (csRes.data ?? []) as unknown as { class_teacher_id: string | null }[];
  const classTeacherIds = new Set(
    csRows.map((r) => r.class_teacher_id).filter((v): v is string => Boolean(v)),
  );

  type Raw = {
    id: string;
    name_bn: string;
    name_en: string;
    email: string | null;
    status: string;
    designation: { name: string | null } | null;
    subject: { name_bn: string | null; name_en: string | null } | null;
  };
  const rows = (teachersRes.data ?? []) as unknown as Raw[];

  return rows.map((r) => ({
    id: r.id,
    name_bn: r.name_bn,
    name_en: r.name_en,
    email: r.email,
    status: r.status,
    designation: r.designation?.name ?? null,
    subject_bn: r.subject?.name_bn ?? null,
    subject_en: r.subject?.name_en ?? null,
    classTeacher: classTeacherIds.has(r.id),
  }));
}
