// Shared Supabase data access for the Student module (update-basic, reports-summary,
// migration merit/no-merit/pushback). RLS-scoped; multi-step writes via transaction
// -safe RPCs. Section options come from @/shared/services/lookups.
import { z } from "zod";
import type { BrowserClient } from "@/shared/services/supabase/types";
import { isoDate, shortText, uuid } from "@/shared/lib/validation";
import { MAX_OPTIONS } from "@/shared/services/supabase/paging";
import { getAssetSignedUrl } from "@/shared/lib/institutionAssets";

/** Migration batches offered for pushback (see `fetchMigrationBatches`). */
const RECENT_BATCHES = 100;


const s = (v: unknown): string => (v == null ? "" : String(v));

/* --------------------------------------------- students (shared roster) */
// Single source of truth lives in the shared roster service.
import { fetchSectionStudents, type SectionStudent } from "@/shared/services/roster/api";
export { fetchSectionStudents, type SectionStudent };

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
  /** Signed URL of the stored photo, so the edit modal shows what is on file
   *  rather than an empty dropzone over a student who already has one. */
  photoUrl: string | null;
};

export async function fetchStudentBasic(
  supabase: BrowserClient,
  studentId: string,
): Promise<StudentBasic> {
  const { data, error } = await supabase
    .from("student")
    .select(
      "id, student_code, name_bn, name_en, dob, gender, blood_group, religion, birth_reg_no, nationality, student_category_id, photo_file_id",
    )
    .eq("id", studentId)
    .single();
  if (error) throw error;
  const t = data;
  // A broken signed URL must not take the edit modal down with it.
  const photoUrl = t.photo_file_id ? await getAssetSignedUrl(supabase, t.photo_file_id).catch(() => null) : null;
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
    photoUrl,
  };
}

/**
 * Student identity write. `dob` is the field that matters: the column is `date`,
 * the input is free text, and a `dd/mm/yyyy` entry casts to either the wrong date
 * or a hard error — on a record used to compute exam eligibility and age reports.
 *
 * Everything else is `.optional()`-free but permissive on content, because this
 * screen legitimately saves partial records (a new admission often has no birth
 * registration number yet) and blocking that would make the form unusable.
 */
export const studentBasicSchema = z
  .object({
    id: uuid,
    name_bn: shortText(120),
    name_en: shortText(120),
    dob: z.union([isoDate, z.literal("")]),
    gender: shortText(16),
    blood_group: shortText(8),
    religion: shortText(32),
    birth_reg_no: shortText(32),
    nationality: shortText(48),
    student_category_id: z.union([uuid, z.literal("")]),
  })
  .strict();

export type StudentBasicPayload = z.input<typeof studentBasicSchema>;

export async function updateStudentBasic(
  supabase: BrowserClient,
  payload: StudentBasicPayload,
): Promise<string> {
  const { data, error } = await supabase.rpc("fn_update_student_basic", { payload: studentBasicSchema.parse(payload) });
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
  /**
   * Coverage counters for the two fields that are routinely blank on an
   * imported roll (C-6). `by_age` is now aggregated over `age_known` rows only,
   * so the screen MUST use these to state the gap rather than letting a bucket
   * absorb it — a roster with no dates of birth previously rendered as
   * "Other — 100%", which reads as a finding about the students.
   *
   * Optional because a client can be served a cached payload minted before the
   * migration that added them; `?? 0` at the call site degrades to the old
   * behaviour instead of rendering NaN.
   */
  age_known?: number;
  dob_missing?: number;
  religion_missing?: number;
  /**
   * Dates of birth that are PRESENT but GENERATED — distinct from missing. The
   * age chart can be drawn from them, and must still say they do not describe
   * real students, or a test fixture quietly becomes a demographic claim.
   */
  dob_synthetic?: number;
};

export async function fetchStudentReport(
  supabase: BrowserClient,
  yearId?: string | null,
): Promise<StudentReport> {
  const { data, error } = await supabase.rpc("fn_student_report_summary", {
    p_academic_year_id: yearId ?? undefined,
  });
  if (error) throw new Error(error.message);
  return data as StudentReport;
}

/* --------------------------------------------------------------- migration */

/**
 * Year-end promotion — the single most destructive write in the product. It
 * re-enrols a whole section into the next class and rewrites roll numbers, and
 * the only way back is `fn_pushback_migration`.
 *
 * The two rules that earn their place:
 *  - `students.min(1)` — an empty list means the operator's selection was lost
 *    somewhere in the UI. Without this the RPC creates an empty completed batch,
 *    which then shows up in the migration history as a promotion that "happened".
 *  - source ≠ target — promoting a section into itself passes every DB constraint
 *    and produces duplicate enrolments that are painful to unpick by hand.
 */
/**
 * Exams available as a promotion basis for the current year.
 *
 * "With merit" promotion has to rank students by SOMETHING, and until this
 * existed it ranked them by their position in the source roster — see
 * `fetchMigrationCandidates` below.
 */
export type ExamOption = { id: string; name: string; status: string };
export async function fetchMigrationExams(
  supabase: BrowserClient,
  yearId: string,
): Promise<ExamOption[]> {
  const { data, error } = await supabase
    .from("exam")
    .select("id, name, status")
    .eq("academic_year_id", yearId)
    .order("created_at", { ascending: false })
    .limit(MAX_OPTIONS);
  if (error) throw error;
  return data ?? [];
}

/** A student in the source section, carrying their real result for the chosen exam. */
export type MigrationCandidate = SectionStudent & {
  merit_rank: number | null;
  result: string | null;
  gpa: number | null;
  /** No processed result for this exam — cannot be ranked or judged. */
  unprocessed: boolean;
};

/**
 * The roster, ordered and annotated by an actual exam result (SRA F-5).
 *
 * WHAT THIS REPLACES. `MigrationRunner` sent `merit_rank: idx + 1`, where `idx`
 * was the index of the student in the source roster *as returned by the query* —
 * i.e. roll order. So "Migration — With Merit" wrote a merit ordering that had
 * nothing to do with merit. It also hardcoded `result: "pass"` for every
 * student, promoting failures as passes. Both values land in a student's
 * permanent academic history through a transactional write that leaves no
 * pre-state, so the damage is not reversible without a manual audit.
 *
 * The results come from `exam_result`, which `fn_process_exam_result` computes
 * set-based in Postgres — the ranking already exists and was simply never read.
 *
 * Two round trips rather than a join: `student_enrollment` and `exam_result`
 * have no FK between them (results key on `student_id`, enrolments on both), and
 * PostgREST cannot express the join without one. Both reads are bounded by the
 * section size.
 */
export async function fetchMigrationCandidates(
  supabase: BrowserClient,
  classSectionId: string,
  examId: string | null,
): Promise<MigrationCandidate[]> {
  const roster = await fetchSectionStudents(supabase, classSectionId);
  if (!examId || roster.length === 0) {
    return roster.map((r) => ({ ...r, merit_rank: null, result: null, gpa: null, unprocessed: Boolean(examId) }));
  }

  const { data, error } = await supabase
    .from("exam_result")
    .select("student_id, merit_rank, result, gpa")
    .eq("exam_id", examId)
    .in("student_id", roster.map((r) => r.studentId))
    .limit(MAX_OPTIONS);
  if (error) throw error;

  const byStudent = new Map((data ?? []).map((r) => [r.student_id, r]));
  return roster
    .map((r) => {
      const res = byStudent.get(r.studentId);
      return {
        ...r,
        merit_rank: res?.merit_rank ?? null,
        result: res?.result ?? null,
        gpa: res?.gpa ?? null,
        unprocessed: !res,
      };
    })
    // Ranked students first in rank order; everyone without a result sinks to
    // the bottom where the operator can see they are the exceptions.
    .sort((a, b) => (a.merit_rank ?? Number.MAX_SAFE_INTEGER) - (b.merit_rank ?? Number.MAX_SAFE_INTEGER));
}

export const runMigrationSchema = z
  .object({
    academic_year_id: uuid,
    source_class_section_id: uuid,
    target_class_section_id: uuid,
    type: z.enum(["merit", "no_merit"]),
    students: z
      .array(
        z.object({
          student_id: uuid,
          source_enrollment_id: uuid,
          merit_rank: z.number().int().positive().optional(),
          result: z.string().optional(),
        }),
      )
      .min(1, "Select at least one student to migrate"),
  })
  .strict()
  .refine((p) => p.source_class_section_id !== p.target_class_section_id, {
    message: "Source and target section must differ",
    path: ["target_class_section_id"],
  });

export type MigrationStudentInput = z.input<typeof runMigrationSchema>["students"][number];
export type RunMigrationPayload = z.input<typeof runMigrationSchema>;

export async function runMigration(
  supabase: BrowserClient,
  payload: RunMigrationPayload,
): Promise<string> {
  const { data, error } = await supabase.rpc("fn_run_migration", { payload: runMigrationSchema.parse(payload) });
  if (error) throw new Error(error.message);
  return (data as string) ?? "";
}

export async function pushbackMigration(
  supabase: BrowserClient,
  batchId: string,
): Promise<number> {
  const { data, error } = await supabase.rpc("fn_pushback_migration", { p_batch_id: batchId });
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

/**
 * Completed migration batches, most recent first.
 *
 * Capped rather than paged on purpose: the result fills a `<Select>`, and a
 * dropdown that needs paging is the wrong control. Pushback is an operation on
 * a *recent* mistake — nobody reverses a promotion from four years ago — so the
 * bound is honest about what the screen is for. Turn this into a paged table if
 * "migration history" ever becomes a reporting surface.
 */
export async function fetchMigrationBatches(
  supabase: BrowserClient,
  yearId: string,
): Promise<MigrationBatchRow[]> {
  const { data, error } = await supabase
    .from("migration_batch")
    .select(
      "id, type, status, created_at, source:source_class_section_id(class:class_id(name_en), section:section_id(name)), target:target_class_section_id(class:class_id(name_en), section:section_id(name)), migration_student(count)",
    )
    .eq("status", "completed")
    .eq("academic_year_id", yearId)
    .order("created_at", { ascending: false })
    .limit(RECENT_BATCHES);
  if (error) throw error;
  return (data ?? []).map((r) => ({
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
    .order("new_roll", { ascending: true }).limit(MAX_OPTIONS);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    name_bn: r.student?.name_bn ?? "",
    name_en: r.student?.name_en ?? "",
    old_roll: r.old_roll,
    new_roll: r.new_roll,
    result: r.result,
  }));
}
