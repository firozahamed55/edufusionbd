// Supabase data access for Core Settings. RLS-scoped; writes via fn_* RPCs.
import type { BrowserClient } from "@/shared/services/supabase/types";

type RpcFn = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
async function call(s: BrowserClient, fn: string, args: Record<string, unknown>): Promise<string> {
  const { data, error } = await (s as unknown as { rpc: RpcFn }).rpc(fn, args);
  if (error) throw new Error(error.message);
  return (data as string) ?? "";
}

/* institution */
export type Institution = {
  id: string; name_bn: string; name_en: string; eiin: string | null; institution_type: string | null; address: string | null;
  phone: string | null; email: string | null; website: string | null; established_year: number | null;
  board_id: string | null; head_teacher_id: string | null; logo_file_id: string | null; metadata: Record<string, unknown>;
};
export async function fetchInstitution(s: BrowserClient): Promise<Institution | null> {
  const { data, error } = await s
    .from("institution")
    .select("id, name_bn, name_en, eiin, institution_type, address, phone, email, website, established_year, board_id, head_teacher_id, logo_file_id, metadata")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as Institution | null) ?? null;
}
export const updateInstitution = (s: BrowserClient, payload: Record<string, unknown>) => call(s, "fn_update_institution", { payload });

export type Option = { id: string; label: string };
export async function fetchEducationBoards(s: BrowserClient): Promise<Option[]> {
  const { data, error } = await s.from("education_board").select("id, name").order("name");
  if (error) throw error;
  return ((data ?? []) as { id: string; name: string }[]).map((r) => ({ id: r.id, label: r.name }));
}

export type TeacherOption = { id: string; label: string; mobile: string | null; email: string | null };
export async function fetchTeacherOptions(s: BrowserClient): Promise<TeacherOption[]> {
  const { data, error } = await s.from("teacher").select("id, name_bn, name_en, mobile, email").is("deleted_at", null).order("name_en");
  if (error) throw error;
  return ((data ?? []) as { id: string; name_bn: string; name_en: string; mobile: string | null; email: string | null }[])
    .map((r) => ({ id: r.id, label: `${r.name_bn} / ${r.name_en}`, mobile: r.mobile, email: r.email }));
}

/* class sections (Class Config master-detail) */
export type ClassSectionRow = { id: string; sectionName: string; capacity: number | null; enrolled: number; classTeacherName: string | null };
export async function fetchClassSections(s: BrowserClient, classId: string): Promise<ClassSectionRow[]> {
  const { data, error } = await s
    .from("class_section")
    .select("id, capacity, section:section_id(name), teacher:class_teacher_id(name_bn, name_en), enrollments:student_enrollment(count)")
    .eq("class_id", classId)
    .is("deleted_at", null);
  if (error) throw error;
  type Raw = {
    id: string; capacity: number | null; section: { name: string } | null;
    teacher: { name_bn: string; name_en: string } | null; enrollments: { count: number }[] | null;
  };
  return ((data ?? []) as unknown as Raw[]).map((r) => ({
    id: r.id, sectionName: r.section?.name ?? "—", capacity: r.capacity,
    enrolled: r.enrollments?.[0]?.count ?? 0, classTeacherName: r.teacher ? `${r.teacher.name_bn}` : null,
  }));
}
export const upsertClassSection = (s: BrowserClient, payload: Record<string, unknown>) => call(s, "fn_upsert_class_section", { payload });
export const deleteClassSection = (s: BrowserClient, id: string) => call(s, "fn_delete_class_section", { p_id: id });

/* generic institution setting (basic_config etc.) via fn_save_setting */
export async function fetchSetting(s: BrowserClient, key: string, scope: string): Promise<Record<string, unknown>> {
  const { data, error } = await s.from("setting").select("value").eq("key", key).eq("scope", scope).maybeSingle();
  if (error) throw error;
  return ((data as { value: Record<string, unknown> } | null)?.value ?? {}) as Record<string, unknown>;
}
export async function saveSetting(s: BrowserClient, key: string, scope: string, value: Record<string, unknown>): Promise<void> {
  await call(s, "fn_save_setting", { p_key: key, p_scope: scope, p_value: value });
}

/* classes */
export type ClassRow = { id: string; name_bn: string; name_en: string; numeric_level: number | null; sectionCount: number };
export async function fetchClasses(s: BrowserClient): Promise<ClassRow[]> {
  const { data, error } = await s
    .from("class")
    .select("id, name_bn, name_en, numeric_level, sections:class_section(count)")
    .is("deleted_at", null)
    .order("numeric_level", { nullsFirst: false });
  if (error) throw error;
  type Raw = { id: string; name_bn: string; name_en: string; numeric_level: number | null; sections: { count: number }[] | null };
  return ((data ?? []) as unknown as Raw[]).map((r) => ({ id: r.id, name_bn: r.name_bn, name_en: r.name_en, numeric_level: r.numeric_level, sectionCount: r.sections?.[0]?.count ?? 0 }));
}
export const upsertClass = (s: BrowserClient, payload: Record<string, unknown>) => call(s, "fn_upsert_class", { payload });
export const deleteClass = (s: BrowserClient, id: string) => call(s, "fn_delete_class", { p_id: id });

/* subjects */
export type SubjectRow = { id: string; name_bn: string; name_en: string; code: string | null; type: string; full_marks: number | null; pass_marks: number | null };
export async function fetchSubjects(s: BrowserClient): Promise<SubjectRow[]> {
  const { data, error } = await s.from("subject").select("id, name_bn, name_en, code, type, full_marks, pass_marks").is("deleted_at", null).order("name_en");
  if (error) throw error;
  return (data ?? []) as unknown as SubjectRow[];
}
export const upsertSubject = (s: BrowserClient, payload: Record<string, unknown>) => call(s, "fn_upsert_subject", { payload });
export const deleteSubject = (s: BrowserClient, id: string) => call(s, "fn_delete_subject", { p_id: id });

/* subject groups */
export type GroupRow = { id: string; name: string; subject_ids: string[]; subject_names: string };
export async function fetchSubjectGroups(s: BrowserClient): Promise<GroupRow[]> {
  const { data, error } = await s.from("subject_group").select("id, name, members:subject_group_member(subject:subject_id(id, name_en))").order("name");
  if (error) throw error;
  type Raw = { id: string; name: string; members: { subject: { id: string; name_en: string } | null }[] | null };
  return ((data ?? []) as unknown as Raw[]).map((r) => {
    const subs = (r.members ?? []).map((m) => m.subject).filter(Boolean) as { id: string; name_en: string }[];
    return { id: r.id, name: r.name, subject_ids: subs.map((x) => x.id), subject_names: subs.map((x) => x.name_en).join(", ") };
  });
}
export const upsertSubjectGroup = (s: BrowserClient, payload: Record<string, unknown>) => call(s, "fn_upsert_subject_group", { payload });
export const deleteSubjectGroup = (s: BrowserClient, id: string) => call(s, "fn_delete_subject_group", { p_id: id });

/* grading */
export type GradeScale = { grade_letter: string; gpa_point: number; min_marks: number; max_marks: number };
export type SchemeRow = { id: string; name: string; is_default: boolean; scales: GradeScale[] };
export async function fetchGradeSchemes(s: BrowserClient): Promise<SchemeRow[]> {
  const { data, error } = await s.from("grade_scheme").select("id, name, is_default, scales:grade_scale(grade_letter, gpa_point, min_marks, max_marks)").is("deleted_at", null).order("name");
  if (error) throw error;
  type Raw = { id: string; name: string; is_default: boolean; scales: GradeScale[] | null };
  return ((data ?? []) as unknown as Raw[]).map((r) => ({ id: r.id, name: r.name, is_default: r.is_default, scales: (r.scales ?? []).sort((a, b) => b.min_marks - a.min_marks) }));
}
export const upsertGradeScheme = (s: BrowserClient, payload: Record<string, unknown>) => call(s, "fn_upsert_grade_scheme", { payload });
export const deleteGradeScheme = (s: BrowserClient, id: string) => call(s, "fn_delete_grade_scheme", { p_id: id });

/* signatures */
export type SignatureRow = { id: string; role_label: string; holder_name: string | null };
export async function fetchSignatures(s: BrowserClient): Promise<SignatureRow[]> {
  const { data, error } = await s.from("signature").select("id, role_label, holder_name").order("created_at");
  if (error) throw error;
  return (data ?? []) as unknown as SignatureRow[];
}
export const upsertSignature = (s: BrowserClient, payload: Record<string, unknown>) => call(s, "fn_upsert_signature", { payload });
export const deleteSignature = (s: BrowserClient, id: string) => call(s, "fn_delete_signature", { p_id: id });

/* users (read-only list) */
export type UserRow = { id: string; full_name: string | null; phone: string | null; status: string; roles: string };

const USERS_PAGE_SIZE = 25;

export async function fetchUsers(
  s: BrowserClient,
  { page = 1, perPage = USERS_PAGE_SIZE }: { page?: number; perPage?: number } = {},
): Promise<{ rows: UserRow[]; total: number }> {
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  const { data, error, count } = await s
    .from("profile")
    .select("id, full_name, phone, status, roles:user_role(role:role_id(name))", { count: "exact" })
    .order("created_at")
    .range(from, to);
  if (error) throw error;
  type Raw = { id: string; full_name: string | null; phone: string | null; status: string; roles: { role: { name: string } | null }[] | null };
  const rows = ((data ?? []) as unknown as Raw[]).map((r) => ({ id: r.id, full_name: r.full_name, phone: r.phone, status: r.status, roles: (r.roles ?? []).map((x) => x.role?.name).filter(Boolean).join(", ") }));
  return { rows, total: count ?? 0 };
}
