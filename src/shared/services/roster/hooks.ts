"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/shared/services/supabase/client";
import { fetchSectionStudents } from "./api";
import { queryKeys } from "@/shared/services/queryKeys";

/** Active students of a class-section (enabled once a section is chosen). */
export function useSectionStudents(classSectionId: string | null) {
  return useQuery({
    queryKey: queryKeys.roster.sectionStudents(classSectionId),
    queryFn: () => fetchSectionStudents(createClient(), classSectionId as string),
    enabled: !!classSectionId,
  });
}
