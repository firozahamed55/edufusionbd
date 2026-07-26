"use client";

import { useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/shared/services/supabase/client";
import { queryKeys } from "@/shared/services/queryKeys";
import { fetchCurrentYear, fetchAcademicYears } from "./api";
import { AcademicYearContext } from "./store";

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

/** Every academic year the institution has — feeds the topbar year switcher. */
export function useAcademicYears() {
  return useQuery({
    queryKey: queryKeys.academicYear.list,
    queryFn: () => fetchAcademicYears(createClient()),
    staleTime: 60 * 60_000,
  });
}

/**
 * The id every year-scoped query should filter on.
 *
 * Reads the operator's SELECTED year from `AcademicYearProvider` when one is
 * mounted (the admin shell), falling back to the DB-defined current year
 * everywhere else. Because the ~21 call sites already take the id as a
 * parameter, adding the switcher required no change at any of them.
 *
 * Returns `undefined` until it loads — pair it with `enabled: !!yearId` so a
 * year-scoped query never fires unscoped. A query that runs before the year is
 * known would return every year's rows, which is the exact bug this prevents.
 */
export function useCurrentYearId(): string | undefined {
  const selected = useContext(AcademicYearContext)?.yearId;
  const fallback = useCurrentYear().data?.id;
  return selected ?? fallback;
}
