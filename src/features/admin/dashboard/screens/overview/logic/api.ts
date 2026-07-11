// Supabase data access for admin/dashboard/overview.
// Reads the security-invoker view v_dashboard_kpi (RLS returns only the caller's
// institution row) + recent notices. No hardcoded figures.
import type { createClient } from "@/shared/services/supabase/client";
import type { Database } from "@/shared/types/database.types";

/** Exact browser-client type (avoids supabase-js generic-arity mismatches). */
export type BrowserClient = ReturnType<typeof createClient>;
type KpiRow = Database["public"]["Views"]["v_dashboard_kpi"]["Row"];

export type DashboardNotice = {
  id: string;
  title: string;
  status: string | null;
  event_date: string | null;
};

export type DashboardData = {
  activeStudents: number;
  activeTeachers: number;
  classSections: number;
  totalDue: number;
  collectedThisMonth: number;
  notices: DashboardNotice[];
};

export async function fetchDashboard(
  supabase: BrowserClient,
): Promise<DashboardData> {
  const [kpiRes, noticeRes] = await Promise.all([
    supabase.from("v_dashboard_kpi").select("*").maybeSingle(),
    supabase
      .from("notice")
      .select("id, title, status, event_date")
      .eq("is_archived", false)
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  if (kpiRes.error) throw kpiRes.error;
  if (noticeRes.error) throw noticeRes.error;

  const k = kpiRes.data as KpiRow | null;
  return {
    activeStudents: Number(k?.active_students ?? 0),
    activeTeachers: Number(k?.active_teachers ?? 0),
    classSections: Number(k?.class_sections ?? 0),
    totalDue: Number(k?.total_due ?? 0),
    collectedThisMonth: Number(k?.collected_this_month ?? 0),
    notices: noticeRes.data ?? [],
  };
}
