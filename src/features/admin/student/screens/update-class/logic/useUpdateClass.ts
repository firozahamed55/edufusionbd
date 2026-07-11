"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/shared/services/supabase/client";
import { fetchClassSections, fetchStudentsBySection } from "./api";

export function useClassSections() {
  return useQuery({
    queryKey: ["class-sections"],
    queryFn: () => fetchClassSections(createClient()),
    staleTime: 5 * 60_000,
  });
}

export function useStudentsBySection(classSectionId: string | null) {
  return useQuery({
    queryKey: ["students", "by-section", classSectionId],
    queryFn: () => fetchStudentsBySection(createClient(), classSectionId as string),
    enabled: !!classSectionId,
  });
}
