"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/shared/services/supabase/client";
import * as api from "./api";

const c = () => createClient();

export const useExams = () => useQuery({ queryKey: ["exam", "list"], queryFn: () => api.fetchExams(c()), staleTime: 60_000 });
export const useGradeSchemes = () => useQuery({ queryKey: ["exam", "grade-schemes"], queryFn: () => api.fetchGradeSchemes(c()), staleTime: 5 * 60_000 });

export const useSectionClassId = (sectionId: string | null) =>
  useQuery({ queryKey: ["exam", "section-class", sectionId], queryFn: () => api.fetchSectionClassId(c(), sectionId as string), enabled: !!sectionId });

export const useExistingMarks = (examId: string | null, classId: string | null, subjectId: string | null) =>
  useQuery({
    queryKey: ["exam", "marks", examId, classId, subjectId],
    queryFn: () => api.fetchExistingMarks(c(), examId as string, classId as string, subjectId as string),
    enabled: !!examId && !!classId && !!subjectId,
  });

export const useExamResults = (examId: string | null, sectionId?: string | null) =>
  useQuery({ queryKey: ["exam", "results", examId, sectionId ?? null], queryFn: () => api.fetchExamResults(c(), examId as string, sectionId), enabled: !!examId });

export const useExamConfig = (kind: "mark" | "comment" | "marksheet" | "date") =>
  useQuery({ queryKey: ["exam", "config", kind], queryFn: () => api.fetchExamConfig(c(), kind) });

export function useUpsertExam() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (p: api.ExamPayload) => api.upsertExam(c(), p), onSuccess: () => qc.invalidateQueries({ queryKey: ["exam", "list"] }) });
}
export function useSaveMarks() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (p: api.SaveMarksPayload) => api.saveMarks(c(), p), onSuccess: () => qc.invalidateQueries({ queryKey: ["exam", "marks"] }) });
}
export function useProcessExam() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (examId: string) => api.processExamResult(c(), examId), onSuccess: () => qc.invalidateQueries({ queryKey: ["exam", "results"] }) });
}
export function useSaveExamConfig(kind: "mark" | "comment" | "marksheet" | "date") {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (config: Record<string, unknown>) => api.saveExamConfig(c(), kind, config), onSuccess: () => qc.invalidateQueries({ queryKey: ["exam", "config", kind] }) });
}
