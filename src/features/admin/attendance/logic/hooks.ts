"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/shared/services/supabase/client";
import * as api from "./api";
import { queryKeys } from "@/shared/services/queryKeys";
import { useCurrentYearId } from "@/shared/services/academicYear/hooks";

const c = () => createClient();

export const useExams = () => {
  const yearId = useCurrentYearId();
  return useQuery({ queryKey: queryKeys.attendance.exams(yearId), queryFn: () => api.fetchExams(c(), yearId as string), enabled: !!yearId, staleTime: 5 * 60_000 });
};

export const useSectionAttendance = (classSectionId: string | null, attDate: string, context: "daily" | "exam", examId?: string | null) =>
  useQuery({
    queryKey: queryKeys.attendance.section(classSectionId, attDate, context, examId),
    queryFn: () => api.fetchSectionAttendance(c(), classSectionId as string, attDate, context, examId),
    enabled: !!classSectionId && !!attDate && (context === "daily" || !!examId),
  });

export const useAttendanceSummary = (classSectionId: string | null, from: string, to: string, enabled: boolean) =>
  useQuery({
    queryKey: queryKeys.attendance.summary(classSectionId, from, to),
    queryFn: () => api.fetchAttendanceSummary(c(), classSectionId, from, to),
    enabled,
  });

export function useMarkAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: api.MarkAttendancePayload) => api.markAttendance(c(), payload),
    // Not `attendance.all` — that also restales the exam option list, which
    // has a 5-minute staleTime and cannot change by marking a register.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.attendance.sectionAll });
      qc.invalidateQueries({ queryKey: queryKeys.attendance.summaryAll });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}
