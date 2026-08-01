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

export type PeriodStats = {
  collected: number;
  attendanceTrend: AttendancePoint[];
  /** Mean of the daily rates in the window; 0 when nothing was recorded. */
  avgRate: number;
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
  const [payments, attendance] = await Promise.all([
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
      const q = supabase.from("attendance").select("att_date, status").gte("att_date", from).lte("att_date", to);
      return (yearId ? q.eq("academic_year_id", yearId) : q).limit(MAX_OPTIONS);
    })(),
  ]);
  if (payments.error) throw payments.error;
  if (attendance.error) throw attendance.error;

  const collected = (payments.data ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);

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

  return { collected, attendanceTrend, avgRate };
}

const nextDay = (day: string) => new Date(new Date(`${day}T00:00:00`).getTime() + DAY_MS).toISOString().slice(0, 10);
