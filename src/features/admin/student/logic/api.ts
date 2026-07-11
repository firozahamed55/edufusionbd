// Shared Supabase data access for the Student module (update-basic, reports-summary,
// migration merit/no-merit/pushback). RLS-scoped; multi-step writes via transaction
// -safe RPCs. Section options come from @/shared/services/lookups.
import type { BrowserClient } from "@/shared/services/supabase/types";

type RpcFn = (
  fn: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>;

const s = (v: unknown): string => (v == null ? "" : String(v));

/* --------------------------------------------- students (shared roster) */
// Single source of truth lives in the shared roster service.
export { fetchSectionStudents, type SectionStudent } from "@/shared/services/roster/api";

/* --------------------------------------------------------- update basic info */

export type StudentBasic = {
  id: string;
  student_code: string | null;
  name_bn: string;
  name_en: string;
  dob: string;
  gender: string;
  blood_group: string; // DB token
  religion: string;
  birth_reg_no: string;
  nationality: string;
  student_category_id: string;
};

export async function fetchStudentBasic(
  supabase: BrowserClient,
  studentId: string,
): Promise<StudentBasic> {
  const { data, error } = await supabase
    .from("student")
    .select(
      "id, student_code, name_bn, name_en, dob, gender, blood_group, religion, birth_reg_no, nationality, student_category_id",
    )
    .eq("id", studentId)
    .single();
  if (error) throw error;
  const t = data as unknown as Record<string, unknown>;
  return {
    id: s(t.id),
    student_code: (t.student_code as string) ?? null,
    name_bn: s(t.name_bn),
    name_en: s(t.name_en),
    dob: s(t.dob),
    gender: s(t.gender),
    blood_group: s(t.blood_group),
    religion: s(t.religion),
    birth_reg_no: s(t.birth_reg_no),
    nationality: s(t.nationality) || "বাংলাদেশি",
    student_category_id: s(t.student_category_id),
  };
}

export type StudentBasicPayload = {
  id: string;
  name_bn: string;
  name_en: string;
  dob: string;
  gender: string;
  blood_group: string; // DB token, mapped by caller
  religion: string;
  birth_reg_no: string;
  nationality: string;
  student_category_id: string;
};

export async function updateStudentBasic(
  supabase: BrowserClient,
  payload: StudentBasicPayload,
): Promise<string> {
  const rpc = supabase.rpc as unknown as RpcFn;
  const { data, error } = await rpc("fn_update_student_basic", { payload });
  if (error) throw new Error(error.message);
  return (data as string) ?? "";
}

/* --------------------------------------------------------------- report */

export type StudentReport = {
  academic_year_id: string | null;
  total: number;
  boys: number;
  girls: number;
  status: Record<string, number>;
  by_class: {
    numeric_level: number;
    name_bn: string;
    name_en: string;
    total: number;
    boys: number;
    girls: number;
    sections: number;
  }[];
  by_religion: Record<string, number>;
  by_age: Record<string, number>;
};

export async function fetchStudentReport(
  supabase: BrowserClient,
  yearId?: string | null,
): Promise<StudentReport> {
  const rpc = supabase.rpc as unknown as RpcFn;
  const { data, error } = await rpc("fn_student_report_summary", {
    p_academic_year_id: yearId ?? null,
  });
  if (error) throw new Error(error.message);
  return data as StudentReport;
}

/* --------------------------------------------------------------- migration */

export type MigrationStudentInput = {
  student_id: string;
  source_enrollment_id: string;
  merit_rank?: number;
  result?: string;
};

export type RunMigrationPayload = {
  academic_year_id: string;
  source_class_section_id: string;
  target_class_section_id: string;
  type: "merit" | "no_merit";
  students: MigrationStudentInput[];
};

export async function runMigration(
  supabase: BrowserClient,
  payload: RunMigrationPayload,
): Promise<string> {
  const rpc = supabase.rpc as unknown as RpcFn;
  const { data, error } = await rpc("fn_run_migration", { payload });
  if (error) throw new Error(error.message);
  return (data as string) ?? "";
}

export async function pushbackMigration(
  supabase: BrowserClient,
  batchId: string,
): Promise<number> {
  const rpc = supabase.rpc as unknown as RpcFn;
  const { data, error } = await rpc("fn_pushback_migration", { p_batch_id: batchId });
  if (error) throw new Error(error.message);
  return (data as number) ?? 0;
}

export type MigrationBatchRow = {
  id: string;
  type: string;
  status: string;
  created_at: string;
  source_label: string;
  target_label: string;
  count: number;
};

function sectionLabel(cs: unknown): string {
  const r = cs as { class?: { name_en?: string | null } | null; section?: { name?: string | null } | null } | null;
  if (!r) return "—";
  return `${r.class?.name_en ?? ""}${r.section?.name ? " — " + r.section.name : ""}`.trim() || "—";
}

export async function fetchMigrationBatches(
  supabase: BrowserClient,
): Promise<MigrationBatchRow[]> {
  const { data, error } = await supabase
    .from("migration_batch")
    .select(
      "id, type, status, created_at, source:source_class_section_id(class:class_id(name_en), section:section_id(name)), target:target_class_section_id(class:class_id(name_en), section:section_id(name)), migration_student(count)",
    )
    .eq("status", "completed")
    .order("created_at", { ascending: false });
  if (error) throw error;
  type Raw = {
    id: string;
    type: string;
    status: string;
    created_at: string;
    source: unknown;
    target: unknown;
    migration_student: { count: number }[] | null;
  };
  return ((data ?? []) as unknown as Raw[]).map((r) => ({
    id: r.id,
    type: r.type,
    status: r.status,
    created_at: r.created_at,
    source_label: sectionLabel(r.source),
    target_label: sectionLabel(r.target),
    count: r.migration_student?.[0]?.count ?? 0,
  }));
}

export type MigrationBatchStudent = {
  name_bn: string;
  name_en: string;
  old_roll: number | null;
  new_roll: number | null;
  result: string | null;
};

export async function fetchMigrationBatchStudents(
  supabase: BrowserClient,
  batchId: string,
): Promise<MigrationBatchStudent[]> {
  const { data, error } = await supabase
    .from("migration_student")
    .select("old_roll, new_roll, result, student:student_id(name_bn, name_en)")
    .eq("migration_batch_id", batchId)
    .order("new_roll", { ascending: true });
  if (error) throw error;
  type Raw = {
    old_roll: number | null;
    new_roll: number | null;
    result: string | null;
    student: { name_bn: string; name_en: string } | null;
  };
  return ((data ?? []) as unknown as Raw[]).map((r) => ({
    name_bn: r.student?.name_bn ?? "",
    name_en: r.student?.name_en ?? "",
    old_roll: r.old_roll,
    new_roll: r.new_roll,
    result: r.result,
  }));
}
