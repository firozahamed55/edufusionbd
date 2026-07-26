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
  type StudentBasicPayload,
  type RunMigrationPayload,
} from "./api";
import { queryKeys } from "@/shared/services/queryKeys";

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

export function useRunMigration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: RunMigrationPayload) => runMigration(c(), payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.students.all });
      qc.invalidateQueries({ queryKey: queryKeys.migration.batches });
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
      qc.invalidateQueries({ queryKey: queryKeys.migration.batches });
    },
  });
}

export function useMigrationBatches() {
  return useQuery({ queryKey: queryKeys.migration.batches, queryFn: () => fetchMigrationBatches(c()) });
}

export function useMigrationBatchStudents(batchId: string | null) {
  return useQuery({
    queryKey: queryKeys.migration.batchStudents(batchId),
    queryFn: () => fetchMigrationBatchStudents(c(), batchId as string),
    enabled: !!batchId,
  });
}
