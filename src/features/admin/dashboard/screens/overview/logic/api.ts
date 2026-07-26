// Supabase data access for admin/dashboard/overview.
// Reads the security-invoker view v_dashboard_kpi (RLS returns only the caller's
// institution row) + recent notices. No hardcoded figures.
import type { createClient } from "@/shared/services/supabase/client";
import type { Database } from "@/shared/types/database.types";
import { MAX_OPTIONS } from "@/shared/services/supabase/paging";

/** Exact browser-client type (avoids supabase-js generic-arity mismatches). */
export type BrowserClient = ReturnType<typeof createClient>;
type KpiRow = Database["public"]["Views"]["v_dashboard_kpi"]["Row"];

export type DashboardNotice = {
  id: string;
  title: string;
  status: string | null;
  event_date: string | null;
};

/** One "needs attention" row — every one is derived from a live query. */
export type AttentionItem = {
  key: string;
  tone: "danger" | "warning" | "info";
  count: number;
  amount?: number;
  href: string;
};

export type AttendancePoint = { date: string; rate: number };

export type ActivityItem = {
  id: string;
  action: string;
  entity: string;
  at: string;
};

export type DashboardData = {
  activeStudents: number;
  activeTeachers: number;
  classSections: number;
  totalDue: number;
  collectedThisMonth: number;
  notices: DashboardNotice[];
  attention: AttentionItem[];
  attendanceTrend: AttendancePoint[];
  activity: ActivityItem[];
};

const DAY_MS = 86_400_000;

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

  const [kpiRes, noticeRes, overdueRes, attendanceRes, riskRes, activityRes] = await Promise.all([
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
        .select("student_id, total_amount, paid_amount, waiver_amount")
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
    supabase
      .from("audit_log")
      .select("id, action, entity, at")
      .order("at", { ascending: false })
      .limit(6),
  ]);

  if (kpiRes.error) throw kpiRes.error;
  if (noticeRes.error) throw noticeRes.error;

  const k = kpiRes.data as KpiRow | null;

  // --- Needs attention (all live) ---
  const attention: AttentionItem[] = [];

  const overdue = overdueRes.data ?? [];
  if (overdue.length > 0) {
    const students = new Set(overdue.map((r) => r.student_id));
    const amount = overdue.reduce(
      (sum, r) => sum + Math.max(0, Number(r.total_amount) - Number(r.paid_amount) - Number(r.waiver_amount)),
      0,
    );
    attention.push({
      key: "overdue_fees",
      tone: "danger",
      count: students.size,
      amount,
      href: "/admin/fee/unpaid-institute",
    });
  }

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

  const overallRate =
    attendanceTrend.length > 0
      ? Math.round(attendanceTrend.reduce((s, p) => s + p.rate, 0) / attendanceTrend.length)
      : 0;
  if (attendanceTrend.length > 0 && overallRate < 75) {
    attention.push({ key: "attendance_low", tone: "warning", count: overallRate, href: "/admin/attendance/analytics" });
  }

  const pendingExams = riskRes.count ?? 0;
  if (pendingExams > 0) {
    attention.push({ key: "results_pending", tone: "info", count: pendingExams, href: "/admin/exam/result-process" });
  }

  return {
    activeStudents: Number(k?.active_students ?? 0),
    activeTeachers: Number(k?.active_teachers ?? 0),
    classSections: Number(k?.class_sections ?? 0),
    totalDue: Number(k?.total_due ?? 0),
    collectedThisMonth: Number(k?.collected_this_month ?? 0),
    notices: noticeRes.data ?? [],
    attention,
    attendanceTrend,
    activity: activityRes.data ?? [],
  };
}
