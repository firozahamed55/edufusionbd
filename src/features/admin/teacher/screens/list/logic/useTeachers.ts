"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/shared/services/supabase/client";
import { queryKeys } from "@/shared/services/queryKeys";
import { useCurrentYearId } from "@/shared/services/academicYear/hooks";
import { fetchTeachers } from "./api";

/**
 * The key comes from the shared `queryKeys` factory and the first-paint args from
 * `./api` — both server-safe modules — because the page prefetches this query
 * (audit H-5). See the note in queryKeys.ts for why they cannot live here.
 */
export function useTeachers(page: number, search: string, departmentId: string) {
  const yearId = useCurrentYearId();
  return useQuery({
    queryKey: queryKeys.teachers.list({ page, search, departmentId }),
    queryFn: () => fetchTeachers(createClient(), { page, search, departmentId, yearId }),
    placeholderData: (prev) => prev,
  });
}
