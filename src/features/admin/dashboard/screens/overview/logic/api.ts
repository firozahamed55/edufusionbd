// Supabase data access for admin/dashboard/overview.
// Reads the security-invoker view v_dashboard_kpi (RLS returns only the caller's
// institution row) + recent notices. No hardcoded figures.
import type { createClient } from "@/shared/services/supabase/client";
import type { Database } from "@/shared/types/database.types";
import { MAX_OPTIONS } from "@/shared/services/supabase/paging";
import type { AttentionFacts } from "../../../logic/attentionRules";

/** Exact browser-client type (avoids supabase-js generic-arity mismatches). */
export type BrowserClient = ReturnType<typeof createClient>;
type KpiRow = Database["public"]["Views"]["v_dashboard_kpi"]["Row"];

export type DashboardNotice = {
  id: string;
  title: string;
  status: string | null;
  event_date: string | null;
};

export type AttendancePoint = { date: string; rate: number };

/**
 * Outstanding money by how long it has been outstanding (D-4).
 *
 * "৳84,000 overdue" is one number covering two situations that call for
 * completely different actions: last week's slow payers, who need a reminder,
 * and a year-old balance, which needs a decision. Bucketing is the difference
 * between a figure and a piece of information.
 */
export type AgeingBucket = { key: "d0_30" | "d31_60" | "d61_90" | "d90_plus"; amount: number; students: number };

/**
 * Where each exam has got to (D-6).
 *
 * The term-end bottleneck was represented on this screen by one alert counting
 * exams sitting in `locked` — the LAST stage before publication. It said
 * nothing about the earlier and much longer stages, which is where a term
 * actually gets stuck. The pipeline is the exam's own `status`, so this costs
 * one query and cannot drift from what the Exam module believes.
 */
export type ExamProgress = { id: string; name: string; status: string; endDate: string | null };

export type ActivityItem = {
  id: string;
  action: string;
  entity: string;
  at: string;
  /**
   * Consecutive rows with the same action+entity, collapsed (SRA B-2). A roster
   * import writes 268 `insert · student` rows in one go; without this the panel
   * is six copies of the same line and every other event on the dashboard is
   * pushed off by a single bulk operation.
   */
  count: number;
  /** The run filled the fetch window, so `count` is a floor: render "N+". */
  partial?: boolean;
};

export type DashboardData = {
  activeStudents: number;
  activeTeachers: number;
  classSections: number;
  totalDue: number;
  collectedThisMonth: number;
  /** Drives the setup checklist's "add subjects" step (was hardcoded false). */
  subjects: number;
  notices: DashboardNotice[];
  /**
   * The half of the attention facts this payload can see. The other half is
   * today-scoped and comes from `fetchToday`; the screen merges them and runs
   * `evaluateAttention` (D-11). Facts, not rows — deciding what is worth
   * showing is the rule table's job, not a fetcher's.
   */
  attentionFacts: Omit<AttentionFacts, "sectionsTotal" | "sectionsAwaitingAttendance" | "hour">;
  ageing: AgeingBucket[];
  exams: ExamProgress[];
  attendanceTrend: AttendancePoint[];
  activity: ActivityItem[];
  /** When this payload was assembled (D-14). */
  fetchedAt: number;
};

const DAY_MS = 86_400_000;

/** Audit rows read for the activity panel; see `collapseActivity`. */
const ACTIVITY_FETCH = 200;

function isoDay(offsetDays: number, now: number): string {
  return new Date(now - offsetDays * DAY_MS).toISOString().slice(0, 10);
}

/**
 * The whole dashboard, from live data.
 *
 * Everything here used to be hardcoded below the three KPIs (audit D-1): the
 * attendance chart, the "avg 91%" caption, and all three priority alerts with
 * fabricated ৳ figures — rendered in the same styling as the live tiles beside
 * them, on the highest-trust surface in the product. `now` is injected so the
 * 30-day window is testable rather than wall-clock dependent.
 */
export async function fetchDashboard(
  supabase: BrowserClient,
  { yearId, now = Date.now() }: { yearId?: string | null; now?: number } = {},
): Promise<DashboardData> {
  const since = isoDay(30, now);

  const [
    kpiRes,
    noticeRes,
    overdueRes,
    attendanceRes,
    riskRes,
    activityRes,
    subjectRes,
    noTeacherRes,
    guardianGapRes,
    examRes,
  ] = await Promise.all([
    supabase.from("v_dashboard_kpi").select("*").maybeSingle(),
    supabase
      .from("notice")
      .select("id, title, status, event_date")
      .eq("is_archived", false)
      .order("created_at", { ascending: false })
      .limit(3),
    // Overdue fees: past the due date and not settled.
    // Year-scoped like every other read of these tables (see academicYear/api.ts)
    // — unscoped, last year's unpaid invoices resurface as today's alerts.
    (() => {
      const q = supabase
        .from("fee_invoice")
        // `due_date` is selected as well as filtered on — the ageing buckets
        // are computed from how far past it each invoice is (D-4).
        .select("student_id, total_amount, paid_amount, waiver_amount, due_date")
        .is("deleted_at", null)
        .lt("due_date", isoDay(0, now))
        .neq("status", "paid");
      return (yearId ? q.eq("academic_year_id", yearId) : q).limit(MAX_OPTIONS);
    })(),
    // 30-day attendance, aggregated in code — one bounded read beats 30 queries.
    (() => {
      const q = supabase.from("attendance").select("att_date, status").gte("att_date", since);
      return (yearId ? q.eq("academic_year_id", yearId) : q).limit(MAX_OPTIONS);
    })(),
    // Results sitting in "locked" — marks are in and frozen, awaiting publish.
    (() => {
      const q = supabase.from("exam").select("id", { count: "exact", head: true }).eq("status", "locked");
      return yearId ? q.eq("academic_year_id", yearId) : q;
    })(),
    // Read deep enough that collapsing a bulk run still leaves distinct events
    // to show — 6 rows of a 268-row import would collapse to a single line.
    supabase
      .from("audit_log")
      .select("id, action, entity, at")
      .order("at", { ascending: false })
      .limit(ACTIVITY_FETCH),
    // Head-only count — the checklist needs "any?", not the rows.
    supabase.from("subject").select("id", { count: "exact", head: true }),
    // Sections nobody owns the register for (D-11 `no_class_teacher`).
    (() => {
      const q = supabase
        .from("class_section")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .is("class_teacher_id", null);
      return yearId ? q.eq("academic_year_id", yearId) : q;
    })(),
    /**
     * Active students reachable by SMS (D-11 `no_guardian_contact`).
     *
     * Read as "students WITH a contactable guardian" and subtracted from the
     * active roll, because PostgREST cannot express "no related row matching a
     * predicate" as a count. The embed is an inner join (`!inner`) so a student
     * with a guardian row but a blank mobile is correctly counted as
     * unreachable rather than as covered.
     */
    supabase
      .from("student")
      .select("id, student_guardian!inner(guardian!inner(mobile))")
      .is("deleted_at", null)
      .eq("status", "active")
      .not("student_guardian.guardian.mobile", "is", null)
      .neq("student_guardian.guardian.mobile", "")
      .limit(MAX_OPTIONS),
    // The term's exams and where each has got to (D-6).
    (() => {
      const q = supabase
        .from("exam")
        .select("id, name, status, end_date")
        .order("end_date", { ascending: false, nullsFirst: false })
        .limit(6);
      return yearId ? q.eq("academic_year_id", yearId) : q;
    })(),
  ]);

  if (kpiRes.error) throw kpiRes.error;
  if (noticeRes.error) throw noticeRes.error;

  const k = kpiRes.data as KpiRow | null;

  // --- Overdue fees, and how old the money is (D-4) ---
  const overdue = overdueRes.data ?? [];
  const owed = (r: { total_amount: number; paid_amount: number; waiver_amount: number }) =>
    Math.max(0, Number(r.total_amount) - Number(r.paid_amount) - Number(r.waiver_amount));

  const overdueStudents = new Set(overdue.map((r) => r.student_id));
  const overdueAmount = overdue.reduce((sum, r) => sum + owed(r), 0);

  const buckets: Record<AgeingBucket["key"], { amount: number; students: Set<string> }> = {
    d0_30: { amount: 0, students: new Set() },
    d31_60: { amount: 0, students: new Set() },
    d61_90: { amount: 0, students: new Set() },
    d90_plus: { amount: 0, students: new Set() },
  };
  for (const row of overdue) {
    if (!row.due_date) continue;
    const days = Math.floor((now - new Date(`${row.due_date}T12:00:00Z`).getTime()) / DAY_MS);
    const key: AgeingBucket["key"] = days > 90 ? "d90_plus" : days > 60 ? "d61_90" : days > 30 ? "d31_60" : "d0_30";
    buckets[key].amount += owed(row);
    buckets[key].students.add(row.student_id);
  }
  const ageing: AgeingBucket[] = (Object.keys(buckets) as AgeingBucket["key"][]).map((key) => ({
    key,
    amount: buckets[key].amount,
    students: buckets[key].students.size,
  }));

  // --- Attendance trend + at-risk students ---
  const byDate = new Map<string, { present: number; total: number }>();
  for (const row of attendanceRes.data ?? []) {
    const bucket = byDate.get(row.att_date) ?? { present: 0, total: 0 };
    bucket.total += 1;
    if (row.status === "present" || row.status === "late") bucket.present += 1;
    byDate.set(row.att_date, bucket);
  }
  const attendanceTrend: AttendancePoint[] = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, b]) => ({ date, rate: b.total > 0 ? Math.round((b.present / b.total) * 100) : 0 }));

  /**
   * `null`, not 0, when the window holds no attendance at all. A school that
   * has never taken a register is not a school at 0% attendance, and the rule
   * table depends on being able to tell those apart.
   */
  const avgAttendance30 =
    attendanceTrend.length > 0
      ? Math.round(attendanceTrend.reduce((s, p) => s + p.rate, 0) / attendanceTrend.length)
      : null;

  const activeStudents = Number(k?.active_students ?? 0);
  // The embed returns one row per student WITH a contactable guardian; the gap
  // is the rest of the active roll. Clamped at zero because the two figures
  // come from different reads and a race must not render a negative count.
  const reachable = (guardianGapRes.data ?? []).length;
  const studentsWithoutGuardianContact = Math.max(0, activeStudents - reachable);

  return {
    activeStudents,
    activeTeachers: Number(k?.active_teachers ?? 0),
    classSections: Number(k?.class_sections ?? 0),
    totalDue: Number(k?.total_due ?? 0),
    collectedThisMonth: Number(k?.collected_this_month ?? 0),
    subjects: subjectRes.count ?? 0,
    notices: noticeRes.data ?? [],
    attentionFacts: {
      overdueStudents: overdueStudents.size,
      overdueAmount,
      avgAttendance30,
      lockedExams: riskRes.count ?? 0,
      sectionsWithoutClassTeacher: noTeacherRes.count ?? 0,
      studentsWithoutGuardianContact,
    },
    ageing,
    exams: (examRes.data ?? []).map((e) => ({
      id: e.id,
      name: e.name,
      status: e.status,
      endDate: e.end_date,
    })),
    attendanceTrend,
    activity: collapseActivity(activityRes.data ?? [], 6, ACTIVITY_FETCH),
    fetchedAt: now,
  };
}

/* ------------------------------------------------------------------- today */

export type PendingSection = { id: string; label_bn: string; label_en: string };

/**
 * Today (analysis II · D-1, D-2, D-10).
 *
 * The dashboard could report a 30-day attendance trend and a period rate and
 * could not answer "who is absent today" — the first question asked in the
 * building every morning. Nor "which sections have not submitted a register
 * yet", which is the same question in the form an operator can act on: with
 * nine class-sections that is a nine-item checklist, clearable before
 * mid-morning.
 *
 * Deliberately its own query, like `fetchPeriodStats`. It is the only part of
 * the screen that must not be served stale, and keeping it separate leaves the
 * server prefetch of the main payload (audit H-5) intact.
 */
export type TodayStats = {
  date: string;
  present: number;
  absent: number;
  late: number;
  onLeave: number;
  sectionsTotal: number;
  sectionsTaken: number;
  /** Named, so the checklist is actionable rather than a bare count. */
  pendingSections: PendingSection[];
  collected: number;
  smsSent: number;
  fetchedAt: number;
};

export async function fetchToday(
  supabase: BrowserClient,
  { yearId, day, now = Date.now() }: { yearId?: string | null; day: string; now?: number },
): Promise<TodayStats> {
  const [sectionsRes, summaryRes, paymentsRes, smsRes] = await Promise.all([
    // Both halves of "N of M" come from THIS list, so the two numbers cannot
    // disagree — `v_dashboard_kpi.class_sections` counts on its own terms.
    (() => {
      const q = supabase
        .from("class_section")
        .select("id, class:class_id(name_bn, name_en, numeric_level), section:section_id(name)")
        .is("deleted_at", null);
      return (yearId ? q.eq("academic_year_id", yearId) : q).limit(MAX_OPTIONS);
    })(),
    (() => {
      const q = supabase
        .from("v_attendance_daily_summary")
        .select("class_section_id, present, absent, late, on_leave")
        .eq("att_date", day);
      return (yearId ? q.eq("academic_year_id", yearId) : q).limit(MAX_OPTIONS);
    })(),
    // `paid_at` is a timestamptz and `day` is an institution-local day, so the
    // bounds are the day's start and the next day's start.
    supabase
      .from("fee_payment")
      .select("amount")
      .gte("paid_at", day)
      .lt("paid_at", nextDay(day))
      .limit(MAX_OPTIONS),
    supabase
      .from("sms_campaign")
      .select("recipient_count")
      .gte("sent_at", day)
      .lt("sent_at", nextDay(day))
      .limit(MAX_OPTIONS),
  ]);

  if (sectionsRes.error) throw sectionsRes.error;
  if (summaryRes.error) throw summaryRes.error;

  const summaries = summaryRes.data ?? [];
  const taken = new Set(summaries.map((r) => r.class_section_id).filter(Boolean) as string[]);

  const sections = (sectionsRes.data ?? [])
    .map((r) => ({
      id: r.id,
      label_bn: `${r.class?.name_bn ?? ""} — ${r.section?.name ?? ""}`,
      label_en: `${r.class?.name_en ?? ""} — ${r.section?.name ?? ""}`,
      level: r.class?.numeric_level ?? 0,
    }))
    .sort((a, b) => a.level - b.level);

  const sum = (pick: (r: (typeof summaries)[number]) => number | null) =>
    summaries.reduce((s, r) => s + Number(pick(r) ?? 0), 0);

  return {
    date: day,
    present: sum((r) => r.present),
    absent: sum((r) => r.absent),
    late: sum((r) => r.late),
    onLeave: sum((r) => r.on_leave),
    sectionsTotal: sections.length,
    sectionsTaken: sections.filter((s) => taken.has(s.id)).length,
    pendingSections: sections
      .filter((s) => !taken.has(s.id))
      .map(({ id, label_bn, label_en }) => ({ id, label_bn, label_en })),
    collected: (paymentsRes.data ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0),
    smsSent: (smsRes.data ?? []).reduce((s, r) => s + Number(r.recipient_count ?? 0), 0),
    fetchedAt: now,
  };
}

/**
 * Collapse consecutive same-action, same-entity audit rows into one item
 * carrying a count, newest first, capped at six (SRA B-2).
 *
 * Consecutive only, deliberately: this is a chronological feed, so merging
 * non-adjacent runs would claim events happened together when they did not.
 * Two separate imports a week apart stay two rows.
 */
export function collapseActivity(
  rows: { id: string; action: string; entity: string; at: string }[],
  limit = 6,
  /**
   * How many rows the query could have returned. A run that reaches the end of
   * a FULL page is not necessarily finished — bulk-updating 268 students inside
   * a 200-row window rendered "200 students updated", which is the fetch limit
   * masquerading as a count. When that happens the item is marked `partial` and
   * the screen shows "200+" rather than asserting a number it cannot know.
   */
  fetched = rows.length,
): ActivityItem[] {
  const out: ActivityItem[] = [];
  let consumed = 0;
  for (const r of rows) {
    const last = out[out.length - 1];
    if (last && last.action === r.action && last.entity === r.entity) {
      last.count += 1;
      consumed += 1;
      continue;
    }
    if (out.length === limit) break;
    out.push({ ...r, count: 1 });
    consumed += 1;
  }
  const tail = out[out.length - 1];
  // Only the LAST group can be truncated, and only if we actually exhausted a
  // full page — a short page means the table simply had nothing more.
  if (tail && consumed === rows.length && rows.length === fetched && fetched > 0) {
    tail.partial = true;
  }
  return out;
}

/* ------------------------------------------------------ period-scoped stats */

/** One class-section's attendance over the window (D-12). */
export type SectionRate = { id: string; label_bn: string; label_en: string; rate: number; records: number };

/**
 * What the school BILLED for this window, and how much of it has been settled
 * (D-3).
 *
 * The defect this replaces: the donut divided `collected in this period` by
 * `that + every unpaid invoice ever raised`. A flow over a stock. A school
 * carrying two years of arrears reads a permanently depressed rate that no
 * month's collecting can move, and a school with no arrears reads 100% in a
 * month it billed nothing — the measure is insensitive to the thing it claims
 * to measure.
 *
 * ANCHORED ON `due_date`, not on `period` and not on `created_at`. `period` is
 * a text month label, so it cannot answer "last 30 days" or a custom range at
 * all; `created_at` is when the row was written, which for a bulk generation
 * run is one instant for a whole year's invoices. The due date is when the
 * school expects the money, which is what a collection rate for a month means.
 *
 * WAIVERS COME OUT OF THE DENOMINATOR. A waived amount was decided not to be
 * collected; leaving it in makes generosity look like failure.
 *
 * `null` when nothing was due in the window. A rate of 0% and "nothing was
 * billed" are different facts, and only one of them is about collecting.
 */
export type BillingStats = {
  billed: number;
  waived: number;
  /** Settled against those invoices — NOT the same as cash taken in the window. */
  collected: number;
  outstanding: number;
  invoices: number;
  students: number;
  /** `collected / (billed − waived)`, rounded. */
  rate: number;
};

export type PeriodStats = {
  collected: number;
  /** Billed vs settled for this window (D-3); `null` when nothing fell due. */
  billing: BillingStats | null;
  attendanceTrend: AttendancePoint[];
  /** Mean of the daily rates in the window; 0 when nothing was recorded. */
  avgRate: number;
  /**
   * D-12. Every figure on this screen was a single institution-level number,
   * so a head teacher could see that attendance was 87% and not which of nine
   * sections was dragging it there — the institution average is precisely the
   * number that hides the answer. Worst first, because that is the one the
   * reader is looking for.
   */
  bySection: SectionRate[];
};

/**
 * The two numbers on the dashboard that are genuinely a function of a DATE
 * RANGE — money collected, and attendance (SRA §A-1: "no period selector").
 *
 * Deliberately separate from `fetchDashboard`. The KPI tiles are point-in-time
 * counts — how many students are enrolled, how much is outstanding right now —
 * and a period selector that appeared to filter them would be reporting a
 * falsehood, which is the exact defect the dashboard rebuild set out to remove.
 * Keeping this a second query also leaves the server prefetch of the main
 * payload (audit H-5) intact, since its cache key never changes.
 */
export async function fetchPeriodStats(
  supabase: BrowserClient,
  { from, to, yearId }: { from: string; to: string; yearId?: string | null },
): Promise<PeriodStats> {
  const [payments, attendance, sectionsRes, billingRes] = await Promise.all([
    // `paid_at` is a timestamptz; `to` is an inclusive day, so the upper bound
    // is the start of the following day rather than midnight of `to` — which
    // would silently drop everything collected on the last day of the range.
    supabase
      .from("fee_payment")
      .select("amount")
      .gte("paid_at", from)
      .lt("paid_at", nextDay(to))
      .limit(MAX_OPTIONS),
    (() => {
      // `class_section_id` rides along for the per-section split (D-12) — the
      // rows are already being read, so segmenting them costs one column.
      const q = supabase
        .from("attendance")
        .select("att_date, status, class_section_id")
        .gte("att_date", from)
        .lte("att_date", to);
      return (yearId ? q.eq("academic_year_id", yearId) : q).limit(MAX_OPTIONS);
    })(),
    (() => {
      const q = supabase
        .from("class_section")
        .select("id, class:class_id(name_bn, name_en, numeric_level), section:section_id(name)")
        .is("deleted_at", null);
      return (yearId ? q.eq("academic_year_id", yearId) : q).limit(MAX_OPTIONS);
    })(),
    // What fell due in this window, however much of it has been settled (D-3).
    // Not year-scoped: the range IS the scope, and a due date inside the window
    // belongs to the window whichever year row carries it.
    supabase
      .from("fee_invoice")
      .select("student_id, total_amount, paid_amount, waiver_amount")
      .is("deleted_at", null)
      .gte("due_date", from)
      .lte("due_date", to)
      .limit(MAX_OPTIONS),
  ]);
  if (payments.error) throw payments.error;
  if (attendance.error) throw attendance.error;

  const collected = (payments.data ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);

  // --- Billed vs settled (D-3) ---
  const invoices = billingRes.data ?? [];
  const billing = invoices.length > 0 ? summariseBilling(invoices) : null;

  const byDate = new Map<string, { present: number; total: number }>();
  for (const row of attendance.data ?? []) {
    const bucket = byDate.get(row.att_date) ?? { present: 0, total: 0 };
    bucket.total += 1;
    if (row.status === "present" || row.status === "late") bucket.present += 1;
    byDate.set(row.att_date, bucket);
  }
  const attendanceTrend: AttendancePoint[] = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, b]) => ({ date, rate: b.total > 0 ? Math.round((b.present / b.total) * 100) : 0 }));

  const avgRate = attendanceTrend.length > 0
    ? Math.round(attendanceTrend.reduce((s, p) => s + p.rate, 0) / attendanceTrend.length)
    : 0;

  // --- Per class-section (D-12) ---
  const bySectionId = new Map<string, { present: number; total: number }>();
  for (const row of attendance.data ?? []) {
    if (!row.class_section_id) continue;
    const b = bySectionId.get(row.class_section_id) ?? { present: 0, total: 0 };
    b.total += 1;
    if (row.status === "present" || row.status === "late") b.present += 1;
    bySectionId.set(row.class_section_id, b);
  }
  const bySection: SectionRate[] = (sectionsRes.data ?? [])
    .flatMap((s) => {
      const b = bySectionId.get(s.id);
      // A section with no records in the window is omitted rather than shown
      // at 0%. "No register was taken" and "nobody came" are different facts,
      // and only one of them is about the students.
      if (!b || b.total === 0) return [];
      return [{
        id: s.id,
        label_bn: `${s.class?.name_bn ?? ""} — ${s.section?.name ?? ""}`,
        label_en: `${s.class?.name_en ?? ""} — ${s.section?.name ?? ""}`,
        rate: Math.round((b.present / b.total) * 100),
        records: b.total,
      }];
    })
    .sort((a, b) => a.rate - b.rate);

  return { collected, billing, attendanceTrend, avgRate, bySection };
}

/**
 * Fold a window's invoices into the billed/settled picture (D-3).
 *
 * Exported and pure so the arithmetic is testable without a database. The one
 * rule worth stating: the rate's denominator is `billed − waived`, and when a
 * window is entirely waived that denominator is zero — reported as 100%,
 * because nothing was left to collect and 0% would name a failure that did not
 * happen.
 */
export function summariseBilling(
  rows: { student_id: string; total_amount: number; paid_amount: number; waiver_amount: number }[],
): BillingStats {
  let billed = 0;
  let waived = 0;
  let collected = 0;
  const students = new Set<string>();
  for (const r of rows) {
    billed += Number(r.total_amount ?? 0);
    waived += Number(r.waiver_amount ?? 0);
    collected += Number(r.paid_amount ?? 0);
    students.add(r.student_id);
  }
  const collectable = billed - waived;
  return {
    billed,
    waived,
    collected,
    // Clamped: an overpayment recorded against one invoice must not render a
    // negative outstanding balance for the window.
    outstanding: Math.max(0, collectable - collected),
    invoices: rows.length,
    students: students.size,
    rate: collectable > 0 ? Math.round((collected / collectable) * 100) : 100,
  };
}

const nextDay = (day: string) => new Date(new Date(`${day}T00:00:00`).getTime() + DAY_MS).toISOString().slice(0, 10);
