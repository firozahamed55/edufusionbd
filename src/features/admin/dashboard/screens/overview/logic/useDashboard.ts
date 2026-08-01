"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/shared/services/supabase/client";
import { queryKeys } from "@/shared/services/queryKeys";
import { useCurrentYearId } from "@/shared/services/academicYear/hooks";
import { localDay } from "@/shared/lib/format";
import { fetchDashboard, fetchPeriodStats, fetchToday } from "./api";

/**
 * Live admin dashboard KPIs, "needs attention" queries, attendance trend and
 * activity feed from Supabase (RLS-scoped).
 *
 * The key comes from `shared/services/queryKeys` — NOT from a constant exported
 * here — because the page server-prefetches this query (audit H-5) and a Server
 * Component cannot import a runtime value out of a `"use client"` module. See the
 * note in queryKeys.ts.
 */
export function useDashboard() {
  const yearId = useCurrentYearId();
  return useQuery({
    queryKey: queryKeys.dashboard.overview,
    queryFn: () => fetchDashboard(createClient(), { yearId }),
  });
}

/**
 * The period-scoped half of the dashboard. Separate query, separate key: the
 * main payload is server-prefetched and its key must stay constant.
 */
export function usePeriodStats(from: string, to: string) {
  const yearId = useCurrentYearId();
  return useQuery({
    queryKey: queryKeys.dashboard.period({ from, to, yearId: yearId ?? "" }),
    queryFn: () => fetchPeriodStats(createClient(), { from, to, yearId }),
    enabled: Boolean(from && to),
    placeholderData: (prev) => prev,
  });
}

/**
 * Today's operating picture (D-10). Its own query and its own, shorter
 * staleness: this is the one band on the screen an operator acts on within the
 * hour, and a register submitted two minutes ago should show as submitted.
 *
 * The day comes from `localDay()` — institution time — not from
 * `toISOString()`, which after 18:00 in Dhaka names yesterday and would report
 * an empty register for a school that has taken every one of them.
 */
export function useToday() {
  const yearId = useCurrentYearId();
  const day = localDay();
  return useQuery({
    queryKey: queryKeys.dashboard.today(day, yearId ?? ""),
    queryFn: () => fetchToday(createClient(), { yearId, day }),
    staleTime: 30_000,
  });
}
