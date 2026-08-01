// Supabase data access for Core Settings. RLS-scoped; writes via fn_* RPCs.
import type { BrowserClient, RpcPayload } from "@/shared/services/supabase/types";
import { MAX_OPTIONS } from "@/shared/services/supabase/paging";

// One narrow seam for the RPCs this module calls: they all return the affected
// row id, so the shared "throw on error, coalesce to string" shape is worth a
// helper. `fn`/`args` stay checked against the generated Database types.
type CoreRpc = Parameters<BrowserClient["rpc"]>;
async function call(s: BrowserClient, fn: CoreRpc[0], args: CoreRpc[1]): Promise<string> {
  const { data, error } = await s.rpc(fn, args);
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
export const updateInstitution = (s: BrowserClient, payload: RpcPayload) => call(s, "fn_update_institution", { payload });

export type Option = { id: string; label: string };
export async function fetchEducationBoards(s: BrowserClient): Promise<Option[]> {
  const { data, error } = await s.from("education_board").select("id, name").order("name").limit(MAX_OPTIONS);
  if (error) throw error;
  return ((data ?? []) as { id: string; name: string }[]).map((r) => ({ id: r.id, label: r.name }));
}

export type TeacherOption = { id: string; label: string; mobile: string | null; email: string | null };
export async function fetchTeacherOptions(s: BrowserClient): Promise<TeacherOption[]> {
  const { data, error } = await s.from("teacher").select("id, name_bn, name_en, mobile, email").is("deleted_at", null).order("name_en").limit(MAX_OPTIONS);
  if (error) throw error;
  return ((data ?? []) as { id: string; name_bn: string; name_en: string; mobile: string | null; email: string | null }[])
    .map((r) => ({ id: r.id, label: `${r.name_bn} / ${r.name_en}`, mobile: r.mobile, email: r.email }));
}

/* class sections (Class Config master-detail) */
export type ClassSectionRow = { id: string; sectionName: string; capacity: number | null; enrolled: number; classTeacherName: string | null };
// Year-scoped (audit A-M16): see shared/services/academicYear/api.ts.
export async function fetchClassSections(s: BrowserClient, classId: string, yearId: string): Promise<ClassSectionRow[]> {
  const { data, error } = await s
    .from("class_section")
    .select("id, capacity, section:section_id(name), teacher:class_teacher_id(name_bn, name_en), enrollments:student_enrollment(count)")
    .eq("class_id", classId)
    .eq("academic_year_id", yearId)
    .is("deleted_at", null).limit(MAX_OPTIONS);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id, sectionName: r.section?.name ?? "—", capacity: r.capacity,
    enrolled: r.enrollments?.[0]?.count ?? 0, classTeacherName: r.teacher ? `${r.teacher.name_bn}` : null,
  }));
}
export const upsertClassSection = (s: BrowserClient, payload: RpcPayload) => call(s, "fn_upsert_class_section", { payload });
export const deleteClassSection = (s: BrowserClient, id: string) => call(s, "fn_delete_class_section", { p_id: id });

/* generic institution setting (basic_config etc.) via fn_save_setting */

/**
 * A setting document and the timestamp it was read at (audit M-3).
 *
 * `updatedAt` is what makes a concurrent edit detectable: the client sends it
 * back on save, and the RPC refuses if the row has moved since. Null means the
 * row does not exist yet, which cannot conflict with anything.
 */
export type SettingDoc = { value: RpcPayload; updatedAt: string | null };

export async function fetchSetting(s: BrowserClient, key: string, scope: string): Promise<SettingDoc> {
  const { data, error } = await s.from("setting").select("value, updated_at").eq("key", key).eq("scope", scope).maybeSingle();
  if (error) throw error;
  const row = data as { value: RpcPayload; updated_at: string | null } | null;
  return { value: (row?.value ?? {}) as RpcPayload, updatedAt: row?.updated_at ?? null };
}

/**
 * Writes only the keys in `value` — the RPC merges rather than replaces, so a
 * partial payload is the intended shape and two operators editing different
 * settings never collide.
 *
 * Pass `expectedUpdatedAt` to make a same-key collision an error instead of a
 * silent overwrite; omit it to force the write (the "overwrite anyway" branch
 * of the conflict dialog). Returns the new timestamp so the caller can advance
 * its baseline without a refetch.
 */
export async function saveSetting(
  s: BrowserClient,
  key: string,
  scope: string,
  value: RpcPayload,
  expectedUpdatedAt?: string | null,
): Promise<string> {
  const { data, error } = await s.rpc("fn_save_setting", {
    p_key: key,
    p_scope: scope,
    p_value: value,
    p_expected_updated_at: expectedUpdatedAt ?? undefined,
  });
  if (error) throw error;
  return (data as string) ?? "";
}

/* classes */
export type ClassRow = { id: string; name_bn: string; name_en: string; numeric_level: number | null; sectionCount: number };
export async function fetchClasses(s: BrowserClient): Promise<ClassRow[]> {
  const { data, error } = await s
    .from("class")
    .select("id, name_bn, name_en, numeric_level, sections:class_section(count)")
    .is("deleted_at", null)
    .order("numeric_level", { nullsFirst: false }).limit(MAX_OPTIONS);
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id, name_bn: r.name_bn, name_en: r.name_en, numeric_level: r.numeric_level, sectionCount: r.sections?.[0]?.count ?? 0 }));
}
export const upsertClass = (s: BrowserClient, payload: RpcPayload) => call(s, "fn_upsert_class", { payload });
export const deleteClass = (s: BrowserClient, id: string) => call(s, "fn_delete_class", { p_id: id });

/* subjects */
export type SubjectRow = {
  id: string; name_bn: string; name_en: string; code: string | null; type: string; full_marks: number | null; pass_marks: number | null;
  min_class_level: number | null; max_class_level: number | null; status: string;
};
export async function fetchSubjects(s: BrowserClient): Promise<SubjectRow[]> {
  const { data, error } = await s.from("subject").select("id, name_bn, name_en, code, type, full_marks, pass_marks, min_class_level, max_class_level, status").is("deleted_at", null).order("name_en").limit(MAX_OPTIONS);
  if (error) throw error;
  return (data ?? []);
}
export const upsertSubject = (s: BrowserClient, payload: RpcPayload) => call(s, "fn_upsert_subject", { payload });
export const deleteSubject = (s: BrowserClient, id: string) => call(s, "fn_delete_subject", { p_id: id });

/* subject groups */
export type GroupRow = { id: string; name: string; subject_ids: string[]; subject_names: string };
export async function fetchSubjectGroups(s: BrowserClient): Promise<GroupRow[]> {
  const { data, error } = await s.from("subject_group").select("id, name, members:subject_group_member(subject:subject_id(id, name_en))").order("name").limit(MAX_OPTIONS);
  if (error) throw error;
  return (data ?? []).map((r) => {
    const subs = (r.members ?? []).map((m) => m.subject).filter(Boolean) as { id: string; name_en: string }[];
    return { id: r.id, name: r.name, subject_ids: subs.map((x) => x.id), subject_names: subs.map((x) => x.name_en).join(", ") };
  });
}
export const upsertSubjectGroup = (s: BrowserClient, payload: RpcPayload) => call(s, "fn_upsert_subject_group", { payload });
export const deleteSubjectGroup = (s: BrowserClient, id: string) => call(s, "fn_delete_subject_group", { p_id: id });

/* grading */
export type GradeScale = { grade_letter: string; gpa_point: number; min_marks: number; max_marks: number };
export type SchemeRow = { id: string; name: string; is_default: boolean; scales: GradeScale[] };
export async function fetchGradeSchemes(s: BrowserClient): Promise<SchemeRow[]> {
  const { data, error } = await s.from("grade_scheme").select("id, name, is_default, scales:grade_scale(grade_letter, gpa_point, min_marks, max_marks)").is("deleted_at", null).order("name").limit(MAX_OPTIONS);
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id, name: r.name, is_default: r.is_default, scales: (r.scales ?? []).sort((a, b) => b.min_marks - a.min_marks) }));
}
export const upsertGradeScheme = (s: BrowserClient, payload: RpcPayload) => call(s, "fn_upsert_grade_scheme", { payload });
export const deleteGradeScheme = (s: BrowserClient, id: string) => call(s, "fn_delete_grade_scheme", { p_id: id });

/* signatures */
export type SignatureRow = { id: string; role_label: string; holder_name: string | null; image_file_id: string | null };
export async function fetchSignatures(s: BrowserClient): Promise<SignatureRow[]> {
  const { data, error } = await s.from("signature").select("id, role_label, holder_name, image_file_id").order("created_at").limit(MAX_OPTIONS);
  if (error) throw error;
  return (data ?? []);
}
export const upsertSignature = (s: BrowserClient, payload: RpcPayload) => call(s, "fn_upsert_signature", { payload });
export const deleteSignature = (s: BrowserClient, id: string) => call(s, "fn_delete_signature", { p_id: id });

/* users */
export type UserRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  status: string;
  /** Display string, comma-joined. */
  roles: string;
  /** Role ids, for the assignment editor. */
  roleIds: string[];
  /** Was absent entirely — "has this account ever been used" is the first
   *  question anyone asks of a user list (SRA A-0.4). */
  lastLoginAt: string | null;
  /** Mirror of `auth.users.email` (audit S-9.3). Identity was name + phone
   *  only, which is not enough to tell two Rahmans apart, and is the address
   *  every invite and recovery mail goes to. */
  email: string | null;
  /** When the invite was sent, so "invited" can say how long ago (S-9.6). */
  invitedAt: string | null;
  /** Why the account was suspended (S-9.10). */
  suspendedReason: string | null;
};

export const USERS_PAGE_SIZE = 25;

export async function fetchUsers(
  s: BrowserClient,
  { page = 1, perPage = USERS_PAGE_SIZE, q = "", status = "" }: { page?: number; perPage?: number; q?: string; status?: string } = {},
): Promise<{ rows: UserRow[]; total: number }> {
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  let query = s
    .from("profile")
    .select(
      "id, full_name, phone, email, status, last_login_at, invited_at, suspended_reason, roles:user_role(role_id, role:role_id(name))",
      { count: "exact" },
    )
    .order("created_at");

  const needle = q.trim().replace(/[%,]/g, "");
  if (needle) query = query.or(`full_name.ilike.%${needle}%,phone.ilike.%${needle}%,email.ilike.%${needle}%`);
  if (status) query = query.eq("status", status);

  const { data, error, count } = await query.range(from, to);
  if (error) throw error;
  const rows = (data ?? []).map((r) => ({
    id: r.id,
    full_name: r.full_name,
    phone: r.phone,
    status: r.status,
    roles: (r.roles ?? []).map((x) => x.role?.name).filter(Boolean).join(", "),
    roleIds: (r.roles ?? []).map((x) => x.role_id).filter(Boolean),
    lastLoginAt: r.last_login_at,
    email: r.email,
    invitedAt: r.invited_at,
    suspendedReason: r.suspended_reason,
  }));
  return { rows, total: count ?? 0 };
}

/* ------------------------------------------------------------------ RBAC */

/**
 * Roles, permissions and grants — the model that shipped in migration
 * 20260726043308 and had no way into the product (SRA F-4).
 */
export type RoleRow = { id: string; code: string; name: string; is_system: boolean };
export type PermissionRow = { id: string; code: string; label: string; module: string };
export type PermissionMatrix = {
  roles: RoleRow[];
  permissions: PermissionRow[];
  grants: { role_id: string; permission_id: string }[];
};

export async function fetchPermissionMatrix(s: BrowserClient): Promise<PermissionMatrix> {
  const { data, error } = await s.rpc("fn_permission_matrix");
  if (error) throw new Error(error.message);
  const m = (data ?? {}) as Partial<PermissionMatrix>;
  return { roles: m.roles ?? [], permissions: m.permissions ?? [], grants: m.grants ?? [] };
}

/** The caller's own permission codes. Drives what the rail shows. */
export async function fetchMyPermissions(s: BrowserClient): Promise<string[]> {
  const { data, error } = await s.rpc("fn_my_permissions");
  if (error) throw new Error(error.message);
  return (data as string[]) ?? [];
}

/**
 * Set semantics: the screen sends the complete intended role list, so a role
 * unticked in the UI is revoked. The RPC refuses to let an operator strip their
 * own last admin role.
 */
export async function setUserRoles(s: BrowserClient, profileId: string, roleIds: string[]): Promise<void> {
  const { error } = await s.rpc("fn_set_user_roles", { payload: { profile_id: profileId, role_ids: roleIds } });
  if (error) throw new Error(error.message);
}

/**
 * Suspend/reactivate. Never a delete — a profile carries audit attribution.
 *
 * `reason` is optional and only meaningful on suspend (audit S-9.10). The RPC
 * also ends the account's live sessions on suspend, which is what makes the
 * confirm dialog's "will no longer be able to sign in" true rather than
 * aspirational.
 */
export async function setUserStatus(
  s: BrowserClient,
  profileId: string,
  status: "active" | "suspended",
  reason?: string,
): Promise<void> {
  const { error } = await s.rpc("fn_set_user_status", {
    payload: { profile_id: profileId, status, reason: reason ?? null },
  });
  if (error) throw new Error(error.message);
}

/* ----------------------------------------------------- global entity search */

/**
 * Students and teachers by name or code, for the ⌘K palette (SRA §6: the
 * palette jumps to SCREENS, and "find student 2026-0417" is the single most
 * frequent intent a registrar has — and it was unserved).
 *
 * Two small queries rather than an RPC: both tables are already RLS-scoped to
 * the institution, both are indexed on the columns searched, and a union would
 * need a SECURITY DEFINER function to re-derive the tenant scope that RLS
 * gives for free here.
 */
export type EntityHit = { kind: "student" | "teacher"; id: string; code: string | null; name_bn: string; name_en: string; detail: string | null };

export const SEARCH_MIN_CHARS = 2;
const SEARCH_LIMIT = 6;

export async function searchEntities(s: BrowserClient, term: string): Promise<EntityHit[]> {
  const needle = term.trim().replace(/[%,]/g, "");
  if (needle.length < SEARCH_MIN_CHARS) return [];
  const like = `%${needle}%`;

  const [students, teachers] = await Promise.all([
    s.from("student")
      .select("id, student_code, name_bn, name_en, enr:current_enrollment_id(roll_no, cs:class_section_id(class:class_id(name_en), section:section_id(name)))")
      .or(`student_code.ilike.${like},name_bn.ilike.${like},name_en.ilike.${like}`)
      .is("deleted_at", null)
      .limit(SEARCH_LIMIT),
    s.from("teacher")
      .select("id, employee_code, name_bn, name_en, designation:designation_id(name)")
      .or(`employee_code.ilike.${like},name_bn.ilike.${like},name_en.ilike.${like}`)
      .is("deleted_at", null)
      .limit(SEARCH_LIMIT),
  ]);
  if (students.error) throw students.error;
  if (teachers.error) throw teachers.error;

  return [
    ...(students.data ?? []).map((r) => ({
      kind: "student" as const,
      id: r.id,
      code: r.student_code,
      name_bn: r.name_bn,
      name_en: r.name_en,
      detail: [r.enr?.cs?.class?.name_en, r.enr?.cs?.section?.name].filter(Boolean).join(" — ") || null,
    })),
    ...(teachers.data ?? []).map((r) => ({
      kind: "teacher" as const,
      id: r.id,
      code: r.employee_code,
      name_bn: r.name_bn,
      name_en: r.name_en,
      detail: r.designation?.name ?? null,
    })),
  ];
}
