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
  department: string | null;
  classTeacher: boolean;
};

const PAGE_SIZE_DEFAULT = 20;

export async function fetchTeachers(
  supabase: BrowserClient,
  { page = 1, perPage = PAGE_SIZE_DEFAULT, search = "", department = "" }:
    { page?: number; perPage?: number; search?: string; department?: string } = {},
): Promise<{ rows: TeacherRow[]; total: number }> {
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  const [teachersRes, csRes] = await Promise.all([
    (() => {
      let q = supabase
        .from("teacher")
        .select(
          "id, name_bn, name_en, email, status, designation:designation_id(name), subject:main_subject_id(name_bn, name_en), department:department_id(name)",
          { count: "exact" },
        )
        .is("deleted_at", null);
      if (search.trim()) {
        const term = search.trim();
        q = q.or(`name_bn.ilike.%${term}%,name_en.ilike.%${term}%,email.ilike.%${term}%`);
      }
      if (department) q = q.eq("department.name", department);
      return q.order("employee_code", { ascending: true }).range(from, to);
    })(),
    supabase.from("class_section").select("class_teacher_id").not("class_teacher_id", "is", null),
  ]);
  if (teachersRes.error) throw teachersRes.error;
  if (csRes.error) throw csRes.error;

  const csRows = (csRes.data ?? []) as unknown as { class_teacher_id: string | null }[];
  const classTeacherIds = new Set(
    csRows.map((r) => r.class_teacher_id).filter((v): v is string => Boolean(v)),
  );

  type Raw = {
    id: string; name_bn: string; name_en: string; email: string | null; status: string;
    designation: { name: string | null } | null;
    subject: { name_bn: string | null; name_en: string | null } | null;
    department: { name: string | null } | null;
  };
  const rows = ((teachersRes.data ?? []) as unknown as Raw[]).map((r) => ({
    id: r.id,
    name_bn: r.name_bn,
    name_en: r.name_en,
    email: r.email,
    status: r.status,
    designation: r.designation?.name ?? null,
    subject_bn: r.subject?.name_bn ?? null,
    subject_en: r.subject?.name_en ?? null,
    department: r.department?.name ?? null,
    classTeacher: classTeacherIds.has(r.id),
  }));

  return { rows, total: teachersRes.count ?? 0 };
}
