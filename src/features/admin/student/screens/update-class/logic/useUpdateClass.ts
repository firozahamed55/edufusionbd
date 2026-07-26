"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/shared/services/supabase/client";
import { fetchClassSections, fetchStudentsBySection } from "./api";
import { queryKeys } from "@/shared/services/queryKeys";

export function useClassSections() {
  return useQuery({
    queryKey: queryKeys.lookup.classSections,
    queryFn: () => fetchClassSections(createClient()),
    staleTime: 5 * 60_000,
  });
}

export function useStudentsBySection(classSectionId: string | null) {
  return useQuery({
    queryKey: queryKeys.students.bySection(classSectionId),
    queryFn: () => fetchStudentsBySection(createClient(), classSectionId as string),
    enabled: !!classSectionId,
  });
}
