"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/shared/services/supabase/client";
import { queryKeys } from "@/shared/services/queryKeys";
import { fetchTeachers } from "./api";

export function useTeachers(page: number, search: string, department: string) {
  return useQuery({
    queryKey: queryKeys.teachers.list({ page, search, department }),
    queryFn: () => fetchTeachers(createClient(), { page, search, department }),
    placeholderData: (prev) => prev,
  });
}
