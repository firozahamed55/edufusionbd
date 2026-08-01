/**
 * The "needs attention" engine (analysis II · D-11).
 *
 * This used to be three `if` blocks pushing onto an array inside `fetchDashboard`
 * — overdue fees, 30-day attendance under 75%, exams locked but unpublished.
 * Three, in imperative code, so adding a fourth was a code change in a fetcher,
 * a new entry in a presentation lookup table on the screen, and a deploy. What
 * the dashboard could tell an administrator to DO was therefore frozen at
 * whatever three conditions happened to be written first.
 *
 * It is a table now. A rule is a row: when it fires, how loudly, where it sends
 * you, what it says, and which permission may see it. Ordering, permission
 * filtering and rendering are shared, so a new rule is a new row and nothing
 * else.
 *
 * SEVERITY IS THE OPERATING RHYTHM, not a taste ranking. Lower sorts first:
 * things that block TODAY sit above things that block this term, which sit
 * above standing data gaps. That is the order the administrator's day runs in
 * (analysis II · B.1), and it is the whole reason the panel exists.
 */

/** One fact-set, evaluated by every rule. Assembled from the live queries. */
export type AttentionFacts = {
  /** Students with an invoice past its due date, and the sum still owed. */
  overdueStudents: number;
  overdueAmount: number;
  /** Mean daily rate over the last 30 days; `null` = nothing recorded at all. */
  avgAttendance30: number | null;
  /** Exams whose marks are frozen but whose results are not published. */
  lockedExams: number;
  /** Class-sections in the current year. */
  sectionsTotal: number;
  /** …of which have no attendance recorded for today. */
  sectionsAwaitingAttendance: number;
  /** …of which have no class teacher assigned. */
  sectionsWithoutClassTeacher: number;
  /** Active students with no guardian mobile number on file. */
  studentsWithoutGuardianContact: number;
  /**
   * Hour of day in institution time (0-23). `attendance_pending` stays silent
   * before the cutoff — a register that is not filled in at 07:40 is not a
   * problem, it is a school that has not opened yet, and an alert that is
   * always red first thing every morning is one nobody reads by Wednesday.
   */
  hour: number;
};

export type AttentionItem = {
  key: string;
  tone: "danger" | "warning" | "info";
  severity: number;
  /** The number the label is built from — students, sections, exams, percent. */
  count: number;
  /** Money, where the rule is about money. */
  amount?: number;
  href: string;
  permission: string;
};

/** Sections must be registered by this hour, institution time, before we nag. */
export const ATTENDANCE_CUTOFF_HOUR = 10;

/** Below this 30-day mean the institution has an attendance problem, not a bad day. */
export const ATTENDANCE_FLOOR_PCT = 75;

type Rule = Omit<AttentionItem, "count" | "amount"> & {
  /** `null` = this rule has nothing to say about these facts. */
  evaluate: (f: AttentionFacts) => { count: number; amount?: number } | null;
};

export const ATTENTION_RULES: Rule[] = [
  {
    key: "attendance_pending",
    tone: "danger",
    severity: 10,
    href: "/admin/attendance/section",
    permission: "attendance.view",
    /**
     * D-1/D-2: the most-asked question in the building, in its actionable form.
     * With 9 class-sections this is a checklist an operator can clear before
     * mid-morning; without it, a section that quietly skipped a day is found at
     * term end, when nothing can be done about it.
     */
    evaluate: (f) =>
      f.hour >= ATTENDANCE_CUTOFF_HOUR && f.sectionsAwaitingAttendance > 0
        ? { count: f.sectionsAwaitingAttendance }
        : null,
  },
  {
    key: "overdue_fees",
    tone: "danger",
    severity: 20,
    href: "/admin/fee/unpaid-institute",
    permission: "fee.view",
    evaluate: (f) => (f.overdueStudents > 0 ? { count: f.overdueStudents, amount: f.overdueAmount } : null),
  },
  {
    key: "results_pending",
    tone: "warning",
    severity: 30,
    href: "/admin/exam/result-process",
    permission: "exam.view",
    evaluate: (f) => (f.lockedExams > 0 ? { count: f.lockedExams } : null),
  },
  {
    key: "attendance_low",
    tone: "warning",
    severity: 40,
    href: "/admin/attendance/analytics",
    permission: "attendance.view",
    /**
     * `null` is not zero. No attendance recorded in 30 days means the school is
     * not using the module — which `attendance_pending` says far better than a
     * "0% attendance" alarm would.
     */
    evaluate: (f) =>
      f.avgAttendance30 !== null && f.avgAttendance30 < ATTENDANCE_FLOOR_PCT
        ? { count: f.avgAttendance30 }
        : null,
  },
  {
    key: "no_class_teacher",
    tone: "info",
    severity: 50,
    href: "/admin/core/class",
    permission: "core.settings",
    /**
     * `class_section.class_teacher_id` is nullable and, at this school, null for
     * every section. Nobody owns the register, nobody owns the parent contact —
     * so the gap that produces `attendance_pending` every morning is invisible
     * on the screen that reports it.
     */
    evaluate: (f) =>
      f.sectionsWithoutClassTeacher > 0 ? { count: f.sectionsWithoutClassTeacher } : null,
  },
  {
    key: "no_guardian_contact",
    tone: "info",
    severity: 60,
    href: "/admin/student/update-basic",
    permission: "student.view",
    /** Every SMS the school sends depends on this, and it fails silently. */
    evaluate: (f) =>
      f.studentsWithoutGuardianContact > 0 ? { count: f.studentsWithoutGuardianContact } : null,
  },
];

/**
 * Run the table. Pure, so the thresholds and the ordering are testable without
 * a database — which is the other half of why this stopped being `if` blocks
 * inside a fetcher.
 */
export function evaluateAttention(facts: AttentionFacts): AttentionItem[] {
  return ATTENTION_RULES.flatMap(({ evaluate, ...meta }) => {
    const hit = evaluate(facts);
    // `evaluate` is destructured OUT rather than spread through: the screen
    // spreads these items into component props, and a function riding along
    // would end up on a DOM node.
    return hit ? [{ ...meta, ...hit }] : [];
  }).sort((a, b) => a.severity - b.severity);
}
