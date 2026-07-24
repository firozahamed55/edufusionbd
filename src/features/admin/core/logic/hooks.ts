"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/shared/services/supabase/client";
import * as api from "./api";

const c = () => createClient();

export const useInstitution = () => useQuery({ queryKey: ["core", "institution"], queryFn: () => api.fetchInstitution(c()) });
export const useEducationBoards = () => useQuery({ queryKey: ["core", "boards"], queryFn: () => api.fetchEducationBoards(c()), staleTime: 60_000 });
export const useTeacherOptions = () => useQuery({ queryKey: ["core", "teacherOptions"], queryFn: () => api.fetchTeacherOptions(c()), staleTime: 60_000 });
export const useSetting = (key: string, scope: string) => useQuery({ queryKey: ["core", "setting", key, scope], queryFn: () => api.fetchSetting(c(), key, scope) });
export const useClasses = () => useQuery({ queryKey: ["core", "classes"], queryFn: () => api.fetchClasses(c()) });
export const useSubjects = () => useQuery({ queryKey: ["core", "subjects"], queryFn: () => api.fetchSubjects(c()) });
export const useSubjectGroups = () => useQuery({ queryKey: ["core", "groups"], queryFn: () => api.fetchSubjectGroups(c()) });
export const useGradeSchemes = () => useQuery({ queryKey: ["core", "schemes"], queryFn: () => api.fetchGradeSchemes(c()) });
export const useSignatures = () => useQuery({ queryKey: ["core", "signatures"], queryFn: () => api.fetchSignatures(c()) });
export const useUsers = (page: number) =>
  useQuery({ queryKey: ["core", "users", "list", page], queryFn: () => api.fetchUsers(c(), { page }), placeholderData: (prev) => prev });
export const useClassSections = (classId: string | null) =>
  useQuery({ queryKey: ["core", "classSections", classId], queryFn: () => api.fetchClassSections(c(), classId as string), enabled: !!classId });

function useMut<T>(fn: (v: T) => Promise<unknown>, keys: string[]) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => keys.forEach((k) => qc.invalidateQueries({ queryKey: ["core", k] })) });
}

export const useUpdateInstitution = () => useMut((p: Record<string, unknown>) => api.updateInstitution(c(), p), ["institution"]);
export const useSaveSetting = (key: string, scope: string) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (value: Record<string, unknown>) => api.saveSetting(c(), key, scope, value), onSuccess: () => qc.invalidateQueries({ queryKey: ["core", "setting", key, scope] }) });
};
export const useUpsertClass = () => useMut((p: Record<string, unknown>) => api.upsertClass(c(), p), ["classes"]);
export const useDeleteClass = () => useMut((id: string) => api.deleteClass(c(), id), ["classes"]);
export const useUpsertSubject = () => useMut((p: Record<string, unknown>) => api.upsertSubject(c(), p), ["subjects"]);
export const useDeleteSubject = () => useMut((id: string) => api.deleteSubject(c(), id), ["subjects"]);
export const useUpsertGroup = () => useMut((p: Record<string, unknown>) => api.upsertSubjectGroup(c(), p), ["groups"]);
export const useDeleteGroup = () => useMut((id: string) => api.deleteSubjectGroup(c(), id), ["groups"]);
export const useUpsertScheme = () => useMut((p: Record<string, unknown>) => api.upsertGradeScheme(c(), p), ["schemes"]);
export const useDeleteScheme = () => useMut((id: string) => api.deleteGradeScheme(c(), id), ["schemes"]);
export const useUpsertSignature = () => useMut((p: Record<string, unknown>) => api.upsertSignature(c(), p), ["signatures"]);
export const useDeleteSignature = () => useMut((id: string) => api.deleteSignature(c(), id), ["signatures"]);
export const useUpsertClassSection = () => useMut((p: Record<string, unknown>) => api.upsertClassSection(c(), p), ["classSections", "classes"]);
export const useDeleteClassSection = () => useMut((id: string) => api.deleteClassSection(c(), id), ["classSections", "classes"]);
