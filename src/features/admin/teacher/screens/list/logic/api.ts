// Supabase data access for admin/teacher/list. RLS-scoped to the caller's institution.
import type { BrowserClient } from "@/shared/services/supabase/types";
import { MAX_OPTIONS } from "@/shared/services/supabase/paging";

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

/**
 * The arguments this screen renders on first paint — no search, no filter, page 1.
 *
 * Lives in this module (which has no `"use client"`) so the RSC that prefetches
 * the query can import it. A Server Component importing this from the hook file
 * would get `undefined` and silently prefetch the wrong key.
 */
export const TEACHER_LIST_FIRST_PAINT = { page: 1, search: "", department: "" } as const;

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
    supabase.from("class_section").select("class_teacher_id").not("class_teacher_id", "is", null).limit(MAX_OPTIONS),
  ]);
  if (teachersRes.error) throw teachersRes.error;
  if (csRes.error) throw csRes.error;

  const csRows = (csRes.data ?? []);
  const classTeacherIds = new Set(
    csRows.map((r) => r.class_teacher_id).filter((v): v is string => Boolean(v)),
  );

  const rows = (teachersRes.data ?? []).map((r) => ({
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
