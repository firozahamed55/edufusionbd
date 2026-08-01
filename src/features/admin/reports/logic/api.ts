// Supabase data access for the Reports module (analysis II · Part C).
//
// Reports is where CROSS-CUTTING, decision-support and printable output lives.
// Module-local operational reports — Day Book, Unpaid by Section, the
// Attendance Register — deliberately stay in their own modules: they are tools
// used inside a workflow, not analysis.
import type { BrowserClient } from "@/shared/services/supabase/types";
import { MAX_OPTIONS } from "@/shared/services/supabase/paging";
import type { Option } from "@/shared/services/lookups/api";

/* ------------------------------------------------------------- enrolment */

/**
 * The filters the enrolment report accepts (R-5).
 *
 * Every field is optional and an empty string means "no filter", matching the
 * `nullif(…, '')` handling in `fn_student_report_summary` — an unset `<select>`
 * posts `""`, and treating that as a filter matching nothing produces an empty
 * report with no visible cause.
 */
export type EnrolmentFilters = {
  class_id?: string;
  class_section_id?: string;
  shift_id?: string;
  gender?: string;
  religion?: string;
  /** Enrolment status; `all` opts out. Defaults to `active` in the RPC. */
  enrollment_status?: string;
  admitted_from?: string;
  admitted_to?: string;
};

export type EnrolmentReport = {
  academic_year_id: string | null;
  /**
   * What the FUNCTION applied, not what the client believes it sent (R-9).
   * The provenance line is only citable if the statement and the query cannot
   * drift apart.
   */
  filters_applied?: Record<string, string>;
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
  by_class_religion?: {
    numeric_level: number;
    name_bn: string;
    name_en: string;
    islam: number;
    hindu: number;
    christian: number;
    buddhist: number;
    other: number;
    not_recorded: number;
    total: number;
  }[];
  age_known?: number;
  dob_missing?: number;
  religion_missing?: number;
  dob_synthetic?: number;
};

export async function fetchEnrolmentReport(
  supabase: BrowserClient,
  yearId: string | null,
  filters: EnrolmentFilters,
): Promise<EnrolmentReport> {
  const { data, error } = await supabase.rpc("fn_student_report_summary", {
    p_academic_year_id: yearId ?? undefined,
    p_filters: filters,
  });
  if (error) throw new Error(error.message);
  return data as EnrolmentReport;
}

/** Shifts, for the filter bar. The other lookups already exist in `lookups/`. */
export async function fetchShifts(supabase: BrowserClient): Promise<Option[]> {
  const { data, error } = await supabase
    .from("shift")
    .select("id, name")
    .is("deleted_at", null)
    .order("name")
    .limit(MAX_OPTIONS);
  if (error) throw error;
  return (data ?? []).map((s) => ({ value: s.id, label_bn: s.name, label_en: s.name }));
}

/* -------------------------------------------------------------- academic */

export type ExamOption = { id: string; name: string; status: string; endDate: string | null };

export async function fetchReportExams(
  supabase: BrowserClient,
  yearId: string | null,
): Promise<ExamOption[]> {
  const q = supabase
    .from("exam")
    .select("id, name, status, end_date")
    .order("end_date", { ascending: false, nullsFirst: false })
    .limit(MAX_OPTIONS);
  const { data, error } = await (yearId ? q.eq("academic_year_id", yearId) : q);
  if (error) throw error;
  return (data ?? []).map((e) => ({ id: e.id, name: e.name, status: e.status, endDate: e.end_date }));
}

export type GradeBand = { grade: string; gpa: number; students: number };
export type SubjectRow = {
  subjectId: string;
  name: string;
  appeared: number;
  absent: number;
  failed: number;
  averagePct: number;
  highest: number | null;
  lowest: number | null;
};
export type ClassRankRow = {
  classSectionId: string;
  label_bn: string;
  label_en: string;
  students: number;
  passed: number;
  averageGpa: number | null;
};

export type AcademicReport = {
  examId: string;
  examName: string;
  examStatus: string;
  /** Students with a processed `exam_result` row. */
  appeared: number;
  passed: number;
  /** `null` when nobody has a processed result — not 0%, which accuses. */
  passRate: number | null;
  averageGpa: number | null;
  grades: GradeBand[];
  subjects: SubjectRow[];
  byClass: ClassRankRow[];
  /**
   * Marks exist but results have not been processed. This is a statement about
   * the WORKFLOW, not about the students, and the screen must say so rather
   * than render an empty grade distribution that reads as "everybody failed".
   */
  marksEntered: number;
  resultsProcessed: number;
  fetchedAt: number;
};

/**
 * The academic performance report (R-1) — "the single largest gap in the
 * product". A school information system that cannot produce a grade
 * distribution, a pass rate, a subject-difficulty comparison or a class
 * ranking is not yet doing the job it was bought for, and `fn_exam_tabulation`
 * plus `grade_scale` have been sitting in the schema since Phase 2.
 *
 * Built from `exam_result` (the processed, ranked outcome) joined to `mark`
 * (the per-subject detail) rather than from `fn_exam_tabulation`, which returns
 * one section's sheet at a time — this report is institution-wide by
 * definition, and calling a per-section RPC nine times to assemble it would be
 * both slower and a different set of numbers if a section were added between
 * calls.
 */
export async function fetchAcademicReport(
  supabase: BrowserClient,
  examId: string,
  now = Date.now(),
): Promise<AcademicReport> {
  const [examRes, resultRes, markRes] = await Promise.all([
    supabase.from("exam").select("id, name, status, grade_scheme_id").eq("id", examId).single(),
    supabase
      .from("exam_result")
      .select("student_id, total_marks, gpa, grade, result, status")
      .eq("exam_id", examId)
      .limit(MAX_OPTIONS),
    // Marks carry the subject; `exam_subject` carries the pass mark. Read
    // together so "below the pass mark" is per-subject rather than a single
    // institution-wide number that no subject actually uses.
    supabase
      .from("mark")
      .select("student_id, marks_obtained, is_absent, exam_subject:exam_subject_id!inner(id, subject_id, full_marks, pass_marks, exam_id, subject:subject_id(name_bn, name_en))")
      .eq("exam_subject.exam_id", examId)
      .limit(MAX_OPTIONS),
  ]);

  if (examRes.error) throw examRes.error;
  if (resultRes.error) throw resultRes.error;
  if (markRes.error) throw markRes.error;

  const exam = examRes.data;
  const results = resultRes.data ?? [];
  const marks = markRes.data ?? [];

  /* --- headline --- */
  const appeared = results.length;
  const passed = results.filter((r) => r.result === "pass").length;
  const gpas = results.map((r) => Number(r.gpa ?? 0)).filter((g) => Number.isFinite(g));

  /* --- grade distribution --- */
  // The scheme's own bands, so a grade the school defined but nobody scored
  // still appears as a zero row: the shape of a distribution includes its
  // empty tail, and dropping A+ because nobody got one hides the finding.
  const gradeRows = exam.grade_scheme_id
    ? await supabase
        .from("grade_scale")
        .select("grade_letter, gpa_point")
        .eq("grade_scheme_id", exam.grade_scheme_id)
        .order("gpa_point", { ascending: false })
        .limit(MAX_OPTIONS)
    : { data: [], error: null };

  const scored = new Map<string, number>();
  for (const r of results) {
    if (!r.grade) continue;
    scored.set(r.grade, (scored.get(r.grade) ?? 0) + 1);
  }
  const grades: GradeBand[] = (gradeRows.data ?? []).map((g) => ({
    grade: g.grade_letter,
    gpa: Number(g.gpa_point ?? 0),
    students: scored.get(g.grade_letter) ?? 0,
  }));
  // A grade present on results but absent from the scheme (the scheme was
  // edited after processing) is appended rather than silently dropped — the
  // students are real whatever the scheme now says.
  for (const [grade, students] of scored) {
    if (!grades.some((g) => g.grade === grade)) grades.push({ grade, gpa: 0, students });
  }

  /* --- subject difficulty --- */
  type MarkRow = (typeof marks)[number];
  const bySubject = new Map<string, { name_bn: string; name_en: string; rows: MarkRow[]; full: number; pass: number }>();
  for (const m of marks) {
    const es = m.exam_subject;
    if (!es?.subject_id) continue;
    const entry = bySubject.get(es.subject_id) ?? {
      name_bn: es.subject?.name_bn ?? "",
      name_en: es.subject?.name_en ?? "",
      rows: [],
      full: Number(es.full_marks ?? 100),
      pass: Number(es.pass_marks ?? 0),
    };
    entry.rows.push(m);
    bySubject.set(es.subject_id, entry);
  }

  const subjects: SubjectRow[] = Array.from(bySubject.entries()).map(([subjectId, s]) => {
    // An absentee has no mark to average or to fail. Counting them as zero
    // would make an outbreak of flu look like a difficult paper — the same
    // distinction the attendance panel makes between "no register" and
    // "nobody came".
    const present = s.rows.filter((r) => !r.is_absent);
    const scores = present.map((r) => Number(r.marks_obtained ?? 0));
    return {
      subjectId,
      name: s.name_en || s.name_bn,
      appeared: present.length,
      absent: s.rows.length - present.length,
      failed: present.filter((r) => Number(r.marks_obtained ?? 0) < s.pass).length,
      averagePct: scores.length > 0 && s.full > 0
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length / s.full) * 100)
        : 0,
      highest: scores.length > 0 ? Math.max(...scores) : null,
      lowest: scores.length > 0 ? Math.min(...scores) : null,
    };
  }).sort((a, b) => b.failed / Math.max(1, b.appeared) - a.failed / Math.max(1, a.appeared));

  /* --- class ranking --- */
  const studentIds = results.map((r) => r.student_id);
  const byClass: ClassRankRow[] = [];
  if (studentIds.length > 0) {
    const { data: enrolments } = await supabase
      .from("student_enrollment")
      .select("student_id, class_section:class_section_id(id, class:class_id(name_bn, name_en, numeric_level), section:section_id(name))")
      .in("student_id", studentIds)
      .eq("status", "active")
      .is("deleted_at", null)
      .limit(MAX_OPTIONS);

    const sectionOf = new Map<string, { id: string; bn: string; en: string; level: number }>();
    for (const e of enrolments ?? []) {
      const cs = e.class_section;
      if (!cs) continue;
      sectionOf.set(e.student_id, {
        id: cs.id,
        bn: `${cs.class?.name_bn ?? ""} — ${cs.section?.name ?? ""}`,
        en: `${cs.class?.name_en ?? ""} — ${cs.section?.name ?? ""}`,
        level: cs.class?.numeric_level ?? 0,
      });
    }

    const agg = new Map<string, { label: { bn: string; en: string; level: number }; students: number; passed: number; gpas: number[] }>();
    for (const r of results) {
      const sec = sectionOf.get(r.student_id);
      if (!sec) continue;
      const a = agg.get(sec.id) ?? { label: { bn: sec.bn, en: sec.en, level: sec.level }, students: 0, passed: 0, gpas: [] };
      a.students += 1;
      if (r.result === "pass") a.passed += 1;
      const g = Number(r.gpa ?? 0);
      if (Number.isFinite(g)) a.gpas.push(g);
      agg.set(sec.id, a);
    }
    for (const [id, a] of agg) {
      byClass.push({
        classSectionId: id,
        label_bn: a.label.bn,
        label_en: a.label.en,
        students: a.students,
        passed: a.passed,
        averageGpa: a.gpas.length > 0 ? Number((a.gpas.reduce((x, y) => x + y, 0) / a.gpas.length).toFixed(2)) : null,
      });
    }
    byClass.sort((a, b) => (b.averageGpa ?? -1) - (a.averageGpa ?? -1));
  }

  return {
    examId,
    examName: exam.name,
    examStatus: exam.status,
    appeared,
    passed,
    passRate: appeared > 0 ? Math.round((passed / appeared) * 100) : null,
    averageGpa: gpas.length > 0 ? Number((gpas.reduce((a, b) => a + b, 0) / gpas.length).toFixed(2)) : null,
    grades,
    subjects,
    byClass,
    marksEntered: marks.length,
    resultsProcessed: appeared,
    fetchedAt: now,
  };
}

/* --------------------------------------------------------------- at-risk */

export type RiskSignal = "attendance" | "arrears" | "marks";

export type AtRiskStudent = {
  studentId: string;
  code: string | null;
  name_bn: string;
  name_en: string;
  section_bn: string;
  section_en: string;
  guardianMobile: string | null;
  /** Attendance rate this year, `null` when no register covers them. */
  attendanceRate: number | null;
  /** Money more than `ARREARS_DAYS` past its due date. */
  arrears: number;
  arrearsDays: number;
  /** GPA change against the previous processed exam; `null` if not comparable. */
  gpaDelta: number | null;
  signals: RiskSignal[];
};

export const RISK = {
  /** The same 75% that gates exam eligibility, deliberately. */
  ATTENDANCE_FLOOR: 75,
  /**
   * Registers a student must appear in before their rate means anything.
   *
   * WITHOUT THIS THE REPORT IS WRONG, and wrong in the most damaging
   * direction. This school has taken the register once: 272 of its 280
   * student-section rows have `total_days = 1`. Every child who happened to be
   * absent that day reads as 0% attendance and lands at the top of a list
   * headed "at risk of dropping out" — 22 of them, with their guardians'
   * phone numbers beside their names, on a page a head teacher is meant to act
   * on. One absence is an incident; a pattern needs enough observations to be
   * a pattern.
   *
   * Twenty is about a month of school days — the shortest window in which
   * "below 75%" describes a habit rather than a bad week.
   */
  MIN_ATTENDANCE_DAYS: 20,
  ARREARS_DAYS: 90,
  /** A GPA fall this large term-on-term is a signal, not noise. */
  GPA_DROP: 0.5,
} as const;

export type AtRiskReport = {
  students: AtRiskStudent[];
  totalStudents: number;
  fetchedAt: number;
  /** Exams the marks signal could be computed from, newest first. */
  comparedExams: { current: string; previous: string } | null;
  /**
   * Whether the attendance signal could be computed at all, and off how much.
   *
   * A suppressed signal must be VISIBLE. "Nobody is at attendance risk" and
   * "we have not taken enough registers to know" are opposite facts that look
   * identical on a screen that simply renders an empty list, and only one of
   * them is good news.
   */
  attendanceCoverage: { assessable: number; maxDays: number };
};

/**
 * The at-risk register (R-4) — "the report that makes the module worth
 * opening".
 *
 * Bangladeshi secondary schools lose students to dropout, and the three
 * signals that precede it are all already in this database: attendance below
 * 75%, marks falling term-on-term, and fees unpaid past 90 days. NO SINGLE
 * MODULE CAN SEE ALL THREE — attendance lives in one screen, arrears in
 * another, results in a third — which is exactly why joining them is a
 * reporting job and not a module feature.
 *
 * Every threshold is a constant in `RISK` above and is rendered on screen, for
 * the reason the insight engine gives: a head teacher is going to phone a
 * family on the strength of this list, so the rule that put the family on it
 * has to be legible.
 */
export async function fetchAtRiskReport(
  supabase: BrowserClient,
  { yearId, now = Date.now() }: { yearId: string | null; now?: number },
): Promise<AtRiskReport> {
  const arrearsCutoff = new Date(now - RISK.ARREARS_DAYS * 86_400_000).toISOString().slice(0, 10);

  const [attendanceRes, invoiceRes, examRes, enrolmentRes] = await Promise.all([
    (() => {
      const q = supabase
        .from("v_attendance_student_summary")
        .select("student_id, present_days, total_days, rate_pct, class_section_id");
      return (yearId ? q.eq("academic_year_id", yearId) : q).limit(MAX_OPTIONS);
    })(),
    // Past the cutoff AND unsettled. Both conditions: a 6-month-old invoice
    // that was paid is not arrears, and last week's unpaid one is not yet a
    // dropout signal.
    supabase
      .from("fee_invoice")
      .select("student_id, total_amount, paid_amount, waiver_amount, due_date")
      .is("deleted_at", null)
      .lt("due_date", arrearsCutoff)
      .neq("status", "paid")
      .limit(MAX_OPTIONS),
    // Two most recent PROCESSED exams — the marks signal is a comparison, so
    // one exam is not enough and an unprocessed one has no GPA to compare.
    (() => {
      const q = supabase
        .from("exam")
        .select("id, name, end_date, status")
        .in("status", ["published", "locked", "processed"])
        .order("end_date", { ascending: false, nullsFirst: false })
        .limit(2);
      return yearId ? q.eq("academic_year_id", yearId) : q;
    })(),
    (() => {
      const q = supabase
        .from("student_enrollment")
        .select("student_id, student:student_id(id, student_code, name_bn, name_en, status, deleted_at, student_guardian(guardian:guardian_id(mobile))), class_section:class_section_id(class:class_id(name_bn, name_en, numeric_level), section:section_id(name))")
        .eq("status", "active")
        .is("deleted_at", null);
      return (yearId ? q.eq("academic_year_id", yearId) : q).limit(MAX_OPTIONS);
    })(),
  ]);

  if (enrolmentRes.error) throw enrolmentRes.error;

  const roster = (enrolmentRes.data ?? []).filter((e) => e.student && !e.student.deleted_at);

  /* --- signal 1: attendance --- */
  // The view is one row per student per section; a student who changed section
  // mid-year has two. Their attendance is the whole year's, so the rows are
  // combined by DAY COUNTS rather than by averaging two rates — averaging a
  // 10-day row against a 150-day row weights them equally.
  const dayTotals = new Map<string, { present: number; total: number }>();
  for (const a of attendanceRes.data ?? []) {
    if (!a.student_id) continue;
    const d = dayTotals.get(a.student_id) ?? { present: 0, total: 0 };
    d.present += Number(a.present_days ?? 0);
    d.total += Number(a.total_days ?? 0);
    dayTotals.set(a.student_id, d);
  }
  const assessable = Array.from(dayTotals.values()).filter((d) => d.total >= RISK.MIN_ATTENDANCE_DAYS).length;
  const maxDays = Math.max(0, ...Array.from(dayTotals.values()).map((d) => d.total));

  /* --- signal 2: arrears --- */
  const arrears = new Map<string, { amount: number; oldest: number }>();
  for (const inv of invoiceRes.data ?? []) {
    const owed = Math.max(0, Number(inv.total_amount) - Number(inv.paid_amount) - Number(inv.waiver_amount));
    if (owed <= 0 || !inv.due_date) continue;
    const days = Math.floor((now - new Date(`${inv.due_date}T12:00:00Z`).getTime()) / 86_400_000);
    const a = arrears.get(inv.student_id) ?? { amount: 0, oldest: 0 };
    a.amount += owed;
    a.oldest = Math.max(a.oldest, days);
    arrears.set(inv.student_id, a);
  }

  /* --- signal 3: falling marks --- */
  const exams = examRes.data ?? [];
  let gpaDelta = new Map<string, number>();
  let comparedExams: AtRiskReport["comparedExams"] = null;
  if (exams.length >= 2) {
    const [current, previous] = exams;
    const [curRes, prevRes] = await Promise.all([
      supabase.from("exam_result").select("student_id, gpa").eq("exam_id", current.id).limit(MAX_OPTIONS),
      supabase.from("exam_result").select("student_id, gpa").eq("exam_id", previous.id).limit(MAX_OPTIONS),
    ]);
    const prev = new Map((prevRes.data ?? []).map((r) => [r.student_id, Number(r.gpa ?? 0)]));
    gpaDelta = new Map(
      (curRes.data ?? []).flatMap((r) => {
        const before = prev.get(r.student_id);
        // No prior result is not a fall. A new admission would otherwise be
        // flagged on their first exam, every time.
        if (before === undefined) return [];
        return [[r.student_id, Number((Number(r.gpa ?? 0) - before).toFixed(2))] as const];
      }),
    );
    comparedExams = { current: current.name, previous: previous.name };
  }

  /* --- join --- */
  const students: AtRiskStudent[] = [];
  for (const e of roster) {
    const s = e.student;
    if (!s) continue;
    const days = dayTotals.get(s.id);
    const rate = days && days.total > 0 ? Math.round((days.present / days.total) * 100) : null;
    // Enough registers for the rate to describe a habit rather than an
    // incident. Reported either way — the column still shows what was recorded
    // — but only a rate over a real window raises the signal.
    const assessed = (days?.total ?? 0) >= RISK.MIN_ATTENDANCE_DAYS;
    const owed = arrears.get(s.id);
    const delta = gpaDelta.get(s.id) ?? null;

    const signals: RiskSignal[] = [];
    if (assessed && rate !== null && rate < RISK.ATTENDANCE_FLOOR) signals.push("attendance");
    if (owed && owed.amount > 0) signals.push("arrears");
    if (delta !== null && delta <= -RISK.GPA_DROP) signals.push("marks");
    if (signals.length === 0) continue;

    const cs = e.class_section;
    students.push({
      studentId: s.id,
      code: s.student_code,
      name_bn: s.name_bn,
      name_en: s.name_en,
      section_bn: `${cs?.class?.name_bn ?? ""} — ${cs?.section?.name ?? ""}`,
      section_en: `${cs?.class?.name_en ?? ""} — ${cs?.section?.name ?? ""}`,
      guardianMobile: s.student_guardian?.[0]?.guardian?.mobile ?? null,
      attendanceRate: rate,
      arrears: owed?.amount ?? 0,
      arrearsDays: owed?.oldest ?? 0,
      gpaDelta: delta,
      signals,
    });
  }

  /**
   * Ranked by NUMBER OF SIGNALS first. A child who is absent, behind on fees
   * and falling in marks is a different case from one with a single large
   * arrears balance, and sorting by any one signal's magnitude would put the
   * second at the top. Ties break on attendance, the signal that precedes the
   * other two.
   */
  students.sort((a, b) =>
    b.signals.length - a.signals.length ||
    (a.attendanceRate ?? 100) - (b.attendanceRate ?? 100) ||
    b.arrears - a.arrears,
  );

  return {
    students,
    totalStudents: roster.length,
    fetchedAt: now,
    comparedExams,
    attendanceCoverage: { assessable, maxDays },
  };
}
