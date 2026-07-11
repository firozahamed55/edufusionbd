// Supabase data access for Core Settings. RLS-scoped; writes via fn_* RPCs.
import type { BrowserClient } from "@/shared/services/supabase/types";

type RpcFn = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const rpc = (s: BrowserClient) => s.rpc as unknown as RpcFn;
async function call(s: BrowserClient, fn: string, args: Record<string, unknown>): Promise<string> {
  const { data, error } = await rpc(s)(fn, args);
  if (error) throw new Error(error.message);
  return (data as string) ?? "";
}

/* institution */
export type Institution = { name_bn: string; name_en: string; eiin: string | null; institution_type: string | null; address: string | null; phone: string | null; email: string | null; website: string | null; established_year: number | null };
export async function fetchInstitution(s: BrowserClient): Promise<Institution | null> {
  const { data, error } = await s.from("institution").select("name_bn, name_en, eiin, institution_type, address, phone, email, website, established_year").limit(1).maybeSingle();
  if (error) throw error;
  return (data as Institution | null) ?? null;
}
export const updateInstitution = (s: BrowserClient, payload: Record<string, unknown>) => call(s, "fn_update_institution", { payload });

/* classes */
export type ClassRow = { id: string; name_bn: string; name_en: string; numeric_level: number | null };
export async function fetchClasses(s: BrowserClient): Promise<ClassRow[]> {
  const { data, error } = await s.from("class").select("id, name_bn, name_en, numeric_level").is("deleted_at", null).order("numeric_level", { nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as unknown as ClassRow[];
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
export async function fetchUsers(s: BrowserClient): Promise<UserRow[]> {
  const { data, error } = await s.from("profile").select("id, full_name, phone, status, roles:user_role(role:role_id(name))").order("created_at");
  if (error) throw error;
  type Raw = { id: string; full_name: string | null; phone: string | null; status: string; roles: { role: { name: string } | null }[] | null };
  return ((data ?? []) as unknown as Raw[]).map((r) => ({ id: r.id, full_name: r.full_name, phone: r.phone, status: r.status, roles: (r.roles ?? []).map((x) => x.role?.name).filter(Boolean).join(", ") }));
}
