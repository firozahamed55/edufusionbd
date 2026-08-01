"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/shared/services/supabase/client";
import { queryKeys } from "@/shared/services/queryKeys";
import { useCurrentYearId } from "@/shared/services/academicYear/hooks";
import {
  fetchAcademicReport,
  fetchAtRiskReport,
  fetchEnrolmentReport,
  fetchReportExams,
  fetchShifts,
  type EnrolmentFilters,
} from "./api";

const c = () => createClient();

/**
 * `staleTime` is longer here than on the dashboard on purpose. A report is
 * read, printed and cited; a figure that changes while the reader is scrolling
 * makes the printed copy and the screen disagree. The dashboard's 60s is right
 * for an operating picture and wrong for a document.
 */
const REPORT_STALE = 5 * 60_000;

export function useEnrolmentReport(filters: EnrolmentFilters) {
  const yearId = useCurrentYearId();
  return useQuery({
    queryKey: queryKeys.reports.enrolment(yearId, filters),
    queryFn: () => fetchEnrolmentReport(c(), yearId ?? null, filters),
    staleTime: REPORT_STALE,
  });
}

export function useShifts() {
  return useQuery({
    queryKey: queryKeys.reports.shifts,
    queryFn: () => fetchShifts(c()),
    staleTime: 60 * 60_000,
  });
}

export function useReportExams() {
  const yearId = useCurrentYearId();
  return useQuery({
    queryKey: queryKeys.reports.exams(yearId),
    queryFn: () => fetchReportExams(c(), yearId ?? null),
    staleTime: REPORT_STALE,
  });
}

export function useAcademicReport(examId: string | null) {
  return useQuery({
    queryKey: queryKeys.reports.academic(examId),
    queryFn: () => fetchAcademicReport(c(), examId as string),
    enabled: !!examId,
    staleTime: REPORT_STALE,
  });
}

export function useAtRiskReport() {
  const yearId = useCurrentYearId();
  return useQuery({
    queryKey: queryKeys.reports.atRisk(yearId),
    queryFn: () => fetchAtRiskReport(c(), { yearId: yearId ?? null }),
    staleTime: REPORT_STALE,
  });
}
