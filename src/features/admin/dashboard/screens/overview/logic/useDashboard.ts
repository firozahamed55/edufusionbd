"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/shared/services/supabase/client";
import { queryKeys } from "@/shared/services/queryKeys";
import { fetchDashboard } from "./api";

/**
 * Live admin dashboard KPIs + recent notices from Supabase (RLS-scoped).
 *
 * The key comes from `shared/services/queryKeys` — NOT from a constant exported
 * here — because the page server-prefetches this query (audit H-5) and a Server
 * Component cannot import a runtime value out of a `"use client"` module. See the
 * note in queryKeys.ts.
 */
export function useDashboard() {
  return useQuery({
    queryKey: queryKeys.dashboard.overview,
    queryFn: () => fetchDashboard(createClient()),
  });
}
