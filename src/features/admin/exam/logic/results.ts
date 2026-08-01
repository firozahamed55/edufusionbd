/**
 * Tabulation, statistics and the publication gate (SRA A-5.2).
 *
 * The matrix and the statistics are computed in Postgres. A 60-student section
 * with 10 subjects is 600 cells; assembling that client-side is 600 rows of
 * `mark` over a school connection, and it silently truncates at PostgREST's
 * row cap on the exact large cohort a tabulation sheet exists for.
 */
import type { BrowserClient } from "@/shared/services/supabase/types";

const num = (v: unknown): number => Number(v ?? 0);

export type TabSubject = {
  subject_id: string;
  name_bn: string;
  name_en: string;
  full_marks: number | null;
  pass_marks: number | null;
};

export type TabCell = { marks: number | null; absent: boolean };

export type TabRow = {
  student_id: string;
  student_code: string | null;
  name_bn: string;
  name_en: string;
  roll: number | null;
  marks: Record<string, TabCell>;
  total: number | null;
  gpa: number | null;
  grade: string | null;
  merit: number | null;
  result: string | null;
};

export type ResultStats = {
  appeared: number;
  passed: number;
  failed: number;
  pass_rate: number;
  avg_gpa: number;
  highest: number;
  lowest: number;
  by_grade: { grade: string; count: number }[];
};

export type Tabulation = { subjects: TabSubject[]; rows: TabRow[]; stats: ResultStats };

export async function fetchTabulation(
  s: BrowserClient,
  examId: string,
  classSectionId: string | null,
): Promise<Tabulation> {
  const { data, error } = await s.rpc("fn_exam_tabulation", {
    p_exam_id: examId,
    p_class_section_id: classSectionId,
  });
  if (error) throw new Error(error.message);
  const r = (data ?? {}) as Record<string, unknown>;
  const stats = (r.stats ?? {}) as Record<string, unknown>;
  return {
    subjects: ((r.subjects ?? []) as Record<string, unknown>[]).map((x) => ({
      subject_id: String(x.subject_id),
      name_bn: String(x.name_bn ?? ""),
      name_en: String(x.name_en ?? ""),
      full_marks: x.full_marks == null ? null : num(x.full_marks),
      pass_marks: x.pass_marks == null ? null : num(x.pass_marks),
    })),
    rows: ((r.rows ?? []) as Record<string, unknown>[]).map((x) => ({
      student_id: String(x.student_id),
      student_code: x.student_code == null ? null : String(x.student_code),
      name_bn: String(x.name_bn ?? ""),
      name_en: String(x.name_en ?? ""),
      roll: x.roll == null ? null : num(x.roll),
      marks: Object.fromEntries(
        Object.entries((x.marks ?? {}) as Record<string, { marks?: unknown; absent?: unknown }>).map(
          ([k, v]) => [k, { marks: v.marks == null ? null : num(v.marks), absent: !!v.absent }],
        ),
      ),
      total: x.total == null ? null : num(x.total),
      gpa: x.gpa == null ? null : num(x.gpa),
      grade: x.grade == null ? null : String(x.grade),
      merit: x.merit == null ? null : num(x.merit),
      result: x.result == null ? null : String(x.result),
    })),
    stats: {
      appeared: num(stats.appeared),
      passed: num(stats.passed),
      failed: num(stats.failed),
      pass_rate: num(stats.pass_rate),
      avg_gpa: num(stats.avg_gpa),
      highest: num(stats.highest),
      lowest: num(stats.lowest),
      by_grade: ((stats.by_grade ?? []) as Record<string, unknown>[]).map((g) => ({
        grade: String(g.grade ?? "—"), count: num(g.count),
      })),
    },
  };
}

export type ResultStatus = {
  status: "draft" | "processed" | "published";
  published_at: string | null;
  published_by: string | null;
  result_count: number;
};

export async function fetchResultStatus(s: BrowserClient, examId: string): Promise<ResultStatus> {
  const { data, error } = await s.rpc("fn_result_status", { p_exam_id: examId });
  if (error) throw new Error(error.message);
  const r = (data ?? {}) as Record<string, unknown>;
  const status = String(r.status ?? "draft");
  return {
    status: status === "published" ? "published" : status === "processed" ? "processed" : "draft",
    published_at: r.published_at == null ? null : String(r.published_at),
    published_by: r.published_by == null ? null : String(r.published_by),
    result_count: num(r.result_count),
  };
}

export async function setPublication(
  s: BrowserClient,
  examId: string,
  publish: boolean,
  reason: string | null,
): Promise<void> {
  const { error } = await s.rpc("fn_set_result_publication", {
    p_exam_id: examId,
    p_publish: publish,
    p_reason: reason,
  });
  if (error) throw new Error(error.message);
}
