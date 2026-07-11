"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/shared/services/supabase/client";
import * as api from "./api";

const c = () => createClient();

export const useExams = () => useQuery({ queryKey: ["attendance", "exams"], queryFn: () => api.fetchExams(c()), staleTime: 5 * 60_000 });

export const useSectionAttendance = (classSectionId: string | null, attDate: string, context: "daily" | "exam", examId?: string | null) =>
  useQuery({
    queryKey: ["attendance", "section", classSectionId, attDate, context, examId ?? null],
    queryFn: () => api.fetchSectionAttendance(c(), classSectionId as string, attDate, context, examId),
    enabled: !!classSectionId && !!attDate && (context === "daily" || !!examId),
  });

export const useAttendanceSummary = (classSectionId: string | null, from: string, to: string, enabled: boolean) =>
  useQuery({
    queryKey: ["attendance", "summary", classSectionId, from, to],
    queryFn: () => api.fetchAttendanceSummary(c(), classSectionId, from, to),
    enabled,
  });

export function useMarkAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: api.MarkAttendancePayload) => api.markAttendance(c(), payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance"] }),
  });
}
