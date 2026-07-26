"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/shared/services/supabase/client";
import type { RpcPayload } from "@/shared/services/supabase/types";
import * as api from "./api";
import { queryKeys } from "@/shared/services/queryKeys";
import { useCurrentYearId } from "@/shared/services/academicYear/hooks";

const c = () => createClient();

export const useExams = () => {
  const yearId = useCurrentYearId();
  return useQuery({ queryKey: queryKeys.exam.list(yearId), queryFn: () => api.fetchExams(c(), yearId as string), enabled: !!yearId, staleTime: 60_000 });
};
export const useGradeSchemes = () => useQuery({ queryKey: queryKeys.exam.gradeSchemes, queryFn: () => api.fetchGradeSchemes(c()), staleTime: 5 * 60_000 });

export const useSectionClassId = (sectionId: string | null) =>
  useQuery({ queryKey: queryKeys.exam.sectionClass(sectionId), queryFn: () => api.fetchSectionClassId(c(), sectionId as string), enabled: !!sectionId });

export const useExistingMarks = (examId: string | null, classId: string | null, subjectId: string | null) =>
  useQuery({
    queryKey: queryKeys.exam.marks(examId, classId, subjectId),
    queryFn: () => api.fetchExistingMarks(c(), examId as string, classId as string, subjectId as string),
    enabled: !!examId && !!classId && !!subjectId,
  });

export const useExamResults = (examId: string | null, sectionId?: string | null) =>
  useQuery({ queryKey: queryKeys.exam.results(examId, sectionId), queryFn: () => api.fetchExamResults(c(), examId as string, sectionId), enabled: !!examId });

export const useExamConfig = (kind: "mark" | "comment" | "marksheet" | "date") =>
  useQuery({ queryKey: queryKeys.exam.config(kind), queryFn: () => api.fetchExamConfig(c(), kind) });

export function useUpsertExam() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (p: api.ExamPayload) => api.upsertExam(c(), p), onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.exam.listAll }) });
}
export function useSaveMarks() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (p: api.SaveMarksPayload) => api.saveMarks(c(), p), onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.exam.marksAll }) });
}
export function useProcessExam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (examId: string) => api.processExamResult(c(), examId),
    // Scoped to the exam that was processed: another exam's results on screen
    // are unaffected and should not refetch.
    onSuccess: (_res, examId) => qc.invalidateQueries({ queryKey: queryKeys.exam.resultsForExam(examId) }),
  });
}
export function useSaveExamConfig(kind: "mark" | "comment" | "marksheet" | "date") {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (config: RpcPayload) => api.saveExamConfig(c(), kind, config), onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.exam.config(kind) }) });
}
