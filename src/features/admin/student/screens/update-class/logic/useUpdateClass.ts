"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/shared/services/supabase/client";
import { fetchClassSections, fetchStudentsBySection } from "./api";
import { queryKeys } from "@/shared/services/queryKeys";
import { useCurrentYearId } from "@/shared/services/academicYear/hooks";

export function useClassSections() {
  const yearId = useCurrentYearId();
  return useQuery({
    queryKey: queryKeys.lookup.classSections(yearId),
    queryFn: () => fetchClassSections(createClient(), yearId as string),
    enabled: !!yearId,
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
