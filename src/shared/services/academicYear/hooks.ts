"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/shared/services/supabase/client";
import { queryKeys } from "@/shared/services/queryKeys";
import { fetchCurrentYear } from "./api";

/**
 * The academic year every year-scoped query filters by. See `./api.ts` for why.
 *
 * One TanStack entry with a long `staleTime`: the answer changes once a year,
 * and every screen that scopes a query shares this cache entry, so the
 * additional round trip happens once per session, not once per screen.
 */
export function useCurrentYear() {
  return useQuery({
    queryKey: queryKeys.academicYear.current,
    queryFn: () => fetchCurrentYear(createClient()),
    staleTime: 60 * 60_000,
  });
}

/**
 * Just the id, for threading into a query.
 *
 * Returns `undefined` until it loads — pair it with `enabled: !!yearId` so a
 * year-scoped query never fires unscoped. A query that runs before the year is
 * known would return every year's rows, which is the exact bug this prevents.
 */
export function useCurrentYearId(): string | undefined {
  return useCurrentYear().data?.id;
}
