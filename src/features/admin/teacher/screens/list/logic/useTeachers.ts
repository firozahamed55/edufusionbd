"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/shared/services/supabase/client";
import { queryKeys } from "@/shared/services/queryKeys";
import { fetchTeachers } from "./api";

/** Live teacher list (RLS-scoped) via TanStack Query. */
export function useTeachers() {
  return useQuery({
    queryKey: queryKeys.teachers.list(),
    queryFn: () => fetchTeachers(createClient()),
  });
}
