"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/shared/services/supabase/client";
import { queryKeys } from "@/shared/services/queryKeys";
import { useCurrentYearId } from "@/shared/services/academicYear/hooks";
import { fetchDashboard, fetchPeriodStats } from "./api";

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
