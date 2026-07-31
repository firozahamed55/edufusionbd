"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/shared/services/supabase/client";
import {
  fetchSectionStudents,
  fetchStudentBasic,
  updateStudentBasic,
  fetchStudentReport,
  runMigration,
  pushbackMigration,
  fetchMigrationBatches,
  fetchMigrationBatchStudents,
  fetchMigrationExams,
  fetchMigrationCandidates,
  type StudentBasicPayload,
  type RunMigrationPayload,
} from "./api";
import { queryKeys } from "@/shared/services/queryKeys";
import { useCurrentYearId } from "@/shared/services/academicYear/hooks";

const c = () => createClient();

export function useSectionStudents(classSectionId: string | null) {
  return useQuery({
    queryKey: queryKeys.students.bySection(classSectionId),
    queryFn: () => fetchSectionStudents(c(), classSectionId as string),
    enabled: !!classSectionId,
  });
}

export function useStudentBasic(studentId: string | null) {
  return useQuery({
    queryKey: queryKeys.students.detail(studentId),
    queryFn: () => fetchStudentBasic(c(), studentId as string),
    enabled: !!studentId,
  });
}

export function useUpdateStudentBasic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: StudentBasicPayload) => updateStudentBasic(c(), payload),
    onSuccess: (_id, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.students.all });
      qc.invalidateQueries({ queryKey: queryKeys.students.detail(vars.id) });
    },
  });
}

export function useStudentReport(yearId?: string | null) {
  return useQuery({
    queryKey: queryKeys.students.report(yearId),
    queryFn: () => fetchStudentReport(c(), yearId ?? null),
    staleTime: 60_000,
  });
}

/** Exams that can serve as the ranking basis for a merit promotion. */
export function useMigrationExams() {
  const yearId = useCurrentYearId();
  return useQuery({
    queryKey: queryKeys.migration.exams(yearId),
    queryFn: () => fetchMigrationExams(c(), yearId as string),
    enabled: !!yearId,
    staleTime: 5 * 60_000,
  });
}

/** The source roster annotated with each student's real result for `examId`. */
export function useMigrationCandidates(classSectionId: string | null, examId: string | null) {
  return useQuery({
    queryKey: queryKeys.migration.candidates(classSectionId, examId),
    queryFn: () => fetchMigrationCandidates(c(), classSectionId as string, examId),
    enabled: !!classSectionId,
  });
}

export function useRunMigration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: RunMigrationPayload) => runMigration(c(), payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.students.all });
      qc.invalidateQueries({ queryKey: queryKeys.migration.all });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}

export function usePushbackMigration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (batchId: string) => pushbackMigration(c(), batchId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.students.all });
      qc.invalidateQueries({ queryKey: queryKeys.migration.all });
    },
  });
}

export function useMigrationBatches() {
  const yearId = useCurrentYearId();
  return useQuery({
    queryKey: queryKeys.migration.batches(yearId),
    queryFn: () => fetchMigrationBatches(c(), yearId as string),
    enabled: !!yearId,
  });
}

export function useMigrationBatchStudents(batchId: string | null) {
  return useQuery({
    queryKey: queryKeys.migration.batchStudents(batchId),
    queryFn: () => fetchMigrationBatchStudents(c(), batchId as string),
    enabled: !!batchId,
  });
}
