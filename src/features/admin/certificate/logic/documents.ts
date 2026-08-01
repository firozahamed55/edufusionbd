/**
 * Roster resolution for a document batch (SRA A-7 points 1 and 9).
 *
 * A batch row is a *specification* — class, optional section, optional roll
 * range, optional explicit student list — not a membership table. Resolving it
 * here rather than materialising members at creation time is deliberate: an
 * ID-card batch created in January and reprinted in June should reflect the
 * students who are actually enrolled, and a batch whose section gained a
 * mid-year admission should include them.
 *
 * `student_ids` overrides everything when present, which is how "print these
 * four" and "exclude the two who transferred out" are both expressible without
 * a second range field.
 */
import type { BrowserClient } from "@/shared/services/supabase/types";
import { MAX_OPTIONS } from "@/shared/services/supabase/paging";
import { BLOOD_LABEL } from "@/shared/constants/enums";

export type BatchStudent = {
  student_id: string;
  student_code: string | null;
  name_bn: string;
  name_en: string;
  roll_no: number | null;
  blood_group: string | null;
  photo_file_id: string | null;
  /** Admit-card only — the seat assigned by `admit_card`, when one exists. */
  seat_no?: string | null;
};

export type BatchSpec = {
  id: string;
  class_id: string | null;
  section_id: string | null;
  roll_from: number | null;
  roll_to: number | null;
  student_ids: string[] | null;
};

type EnrollmentRow = {
  roll_no: number | null;
  student: {
    id: string; student_code: string | null; name_bn: string; name_en: string;
    blood_group: string | null; photo_file_id: string | null;
  } | null;
};

function toStudents(rows: EnrollmentRow[]): BatchStudent[] {
  return rows
    .filter((r): r is EnrollmentRow & { student: NonNullable<EnrollmentRow["student"]> } => !!r.student)
    .map((r) => ({
      student_id: r.student.id,
      student_code: r.student.student_code,
      name_bn: r.student.name_bn,
      name_en: r.student.name_en,
      roll_no: r.roll_no,
      blood_group: r.student.blood_group ? BLOOD_LABEL[r.student.blood_group] ?? null : null,
      photo_file_id: r.student.photo_file_id,
    }))
    .sort((a, b) => (a.roll_no ?? Number.MAX_SAFE_INTEGER) - (b.roll_no ?? Number.MAX_SAFE_INTEGER));
}

const SELECT =
  "roll_no, student:student_id(id, student_code, name_bn, name_en, blood_group, photo_file_id)";

/**
 * Resolve a batch to its students.
 *
 * `yearId` scopes the enrolment (audit A-M16). Without it a class that has run
 * for five years resolves to five cohorts stacked on top of each other, and
 * the sheet prints 2000 cards for a section of 40.
 */
export async function fetchBatchStudents(
  s: BrowserClient,
  spec: BatchSpec,
  yearId: string,
): Promise<BatchStudent[]> {
  if (spec.student_ids && spec.student_ids.length > 0) {
    const { data, error } = await s
      .from("student_enrollment")
      .select(SELECT)
      .in("student_id", spec.student_ids)
      .eq("academic_year_id", yearId)
      .is("deleted_at", null)
      .limit(MAX_OPTIONS);
    if (error) throw error;
    return toStudents((data ?? []) as EnrollmentRow[]);
  }

  if (!spec.class_id) return [];

  // The batch stores `section_id` against `section`, while enrolment hangs off
  // `class_section` — so the section filter has to go through the join, not
  // straight onto the enrolment row.
  let query = s
    .from("student_enrollment")
    .select(`${SELECT}, cs:class_section_id!inner(class_id, section_id)`)
    .eq("cs.class_id", spec.class_id)
    .eq("academic_year_id", yearId)
    .is("deleted_at", null)
    .limit(MAX_OPTIONS);

  if (spec.section_id) query = query.eq("cs.section_id", spec.section_id);
  if (spec.roll_from != null) query = query.gte("roll_no", spec.roll_from);
  if (spec.roll_to != null) query = query.lte("roll_no", spec.roll_to);

  const { data, error } = await query;
  if (error) throw error;
  return toStudents((data ?? []) as EnrollmentRow[]);
}

/** Seat numbers assigned to an admit-card batch, keyed by student id. */
export async function fetchSeatNumbers(s: BrowserClient, batchId: string): Promise<Record<string, string>> {
  const { data, error } = await s
    .from("admit_card")
    .select("student_id, seat_no")
    .eq("admit_card_batch_id", batchId)
    .limit(MAX_OPTIONS);
  if (error) throw error;
  const out: Record<string, string> = {};
  for (const r of (data ?? []) as { student_id: string | null; seat_no: string | null }[]) {
    if (r.student_id && r.seat_no) out[r.student_id] = r.seat_no;
  }
  return out;
}

/**
 * Subjects and their sitting dates for an admit card.
 *
 * From `exam_subject`, which carries `exam_date`, `start_time` and `duration`
 * per subject per class — real scheduled data, not the free text an operator
 * would otherwise retype onto every card.
 */
export async function fetchExamSubjects(
  s: BrowserClient,
  examId: string,
  classId: string,
  isBn: boolean,
): Promise<{ name: string; date: string | null; time: string | null }[]> {
  const { data, error } = await s
    .from("exam_subject")
    .select("exam_date, start_time, subject:subject_id(name_bn, name_en)")
    .eq("exam_id", examId)
    .eq("class_id", classId)
    .order("exam_date", { ascending: true, nullsFirst: false })
    .limit(MAX_OPTIONS);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    name: (isBn ? r.subject?.name_bn : r.subject?.name_en) ?? "—",
    date: r.exam_date,
    time: r.start_time,
  }));
}

/* ------------------------------------------------------------- batch detail */

export type BatchDetail = {
  id: string;
  created_at: string;
  created_by_name: string | null;
  card_count: number | null;
  status: string;
  cancel_reason: string | null;
  theme: string | null;
  valid_till: string | null;
  center: string | null;
  issue_date: string | null;
  exam_id: string | null;
  exam_name: string | null;
  class_name: string;
  section_name: string | null;
  roll_from: number | null;
  roll_to: number | null;
  class_id: string | null;
  section_id: string | null;
  student_ids: string[] | null;
};

type BatchDetailRaw = {
  id: string; created_at: string; roll_from: number | null; roll_to: number | null;
  card_count: number | null; status: string; cancel_reason: string | null; theme: string | null;
  student_ids: string[] | null; class_id: string | null; section_id: string | null; exam_id?: string | null;
  valid_till?: string | null; center?: string | null; issue_date?: string | null;
  class: { name_bn: string; name_en: string } | null;
  section: { name: string } | null;
  creator: { full_name: string | null } | null;
  exam?: { name: string } | null;
};

const DETAIL_COMMON =
  "id, created_at, roll_from, roll_to, card_count, status, cancel_reason, theme, student_ids, class_id, section_id," +
  " class:class_id(name_bn, name_en), section:section_id(name), creator:created_by(full_name)";

function mapDetail(r: BatchDetailRaw, isBn: boolean): BatchDetail {
  return {
    id: r.id, created_at: r.created_at, created_by_name: r.creator?.full_name ?? null,
    card_count: r.card_count, status: r.status, cancel_reason: r.cancel_reason, theme: r.theme,
    valid_till: r.valid_till ?? null, center: r.center ?? null, issue_date: r.issue_date ?? null,
    exam_id: r.exam_id ?? null, exam_name: r.exam?.name ?? null,
    class_name: (isBn ? r.class?.name_bn : r.class?.name_en) ?? "—",
    section_name: r.section?.name ?? null,
    roll_from: r.roll_from, roll_to: r.roll_to,
    class_id: r.class_id, section_id: r.section_id, student_ids: r.student_ids,
  };
}

export async function fetchIdBatchDetails(s: BrowserClient, isBn: boolean): Promise<BatchDetail[]> {
  const { data, error } = await s.from("id_card_batch")
    .select(`${DETAIL_COMMON}, valid_till`)
    .order("created_at", { ascending: false }).limit(50);
  if (error) throw error;
  return ((data ?? []) as unknown as BatchDetailRaw[]).map((r) => mapDetail(r, isBn));
}

export async function fetchAdmitBatchDetails(s: BrowserClient, isBn: boolean): Promise<BatchDetail[]> {
  const { data, error } = await s.from("admit_card_batch")
    .select(`${DETAIL_COMMON}, center, issue_date, exam_id, exam:exam_id(name)`)
    .order("created_at", { ascending: false }).limit(50);
  if (error) throw error;
  return ((data ?? []) as unknown as BatchDetailRaw[]).map((r) => mapDetail(r, isBn));
}

export async function cancelBatch(s: BrowserClient, kind: "id" | "admit", id: string, reason: string): Promise<void> {
  const { error } = await s.rpc("fn_cancel_document_batch", { p_kind: kind, p_id: id, p_reason: reason });
  if (error) throw new Error(error.message);
}
