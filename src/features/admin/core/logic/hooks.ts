"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/shared/services/supabase/client";
import type { RpcPayload } from "@/shared/services/supabase/types";
import * as api from "./api";
import { queryKeys } from "@/shared/services/queryKeys";
import { useCurrentYearId } from "@/shared/services/academicYear/hooks";

const c = () => createClient();

export const useInstitution = () => useQuery({ queryKey: queryKeys.core.institution, queryFn: () => api.fetchInstitution(c()) });
export const useEducationBoards = () => useQuery({ queryKey: queryKeys.core.boards, queryFn: () => api.fetchEducationBoards(c()), staleTime: 60_000 });
export const useTeacherOptions = () => useQuery({ queryKey: queryKeys.core.teacherOptions, queryFn: () => api.fetchTeacherOptions(c()), staleTime: 60_000 });
export const useSetting = (key: string, scope: string) => useQuery({ queryKey: queryKeys.core.setting(key, scope), queryFn: () => api.fetchSetting(c(), key, scope) });
export const useClasses = () => useQuery({ queryKey: queryKeys.core.classes, queryFn: () => api.fetchClasses(c()) });
export const useSubjects = () => useQuery({ queryKey: queryKeys.core.subjects, queryFn: () => api.fetchSubjects(c()) });
export const useSubjectGroups = () => useQuery({ queryKey: queryKeys.core.groups, queryFn: () => api.fetchSubjectGroups(c()) });
export const useGradeSchemes = () => useQuery({ queryKey: queryKeys.core.schemes, queryFn: () => api.fetchGradeSchemes(c()) });
export const useSignatures = () => useQuery({ queryKey: queryKeys.core.signatures, queryFn: () => api.fetchSignatures(c()) });
export const useUsers = (params: { page: number; q?: string; status?: string }) =>
  useQuery({ queryKey: queryKeys.core.users(params), queryFn: () => api.fetchUsers(c(), params), placeholderData: (prev) => prev });

/**
 * The caller's own permission codes (SRA F-4). Long staleTime: permissions
 * change when someone edits a role, not while an operator works, and this
 * gates the navigation rail on every render.
 */
export const useMyPermissions = () =>
  useQuery({ queryKey: queryKeys.core.myPermissions, queryFn: () => api.fetchMyPermissions(c()), staleTime: 5 * 60_000 });

export const usePermissionMatrix = () =>
  useQuery({ queryKey: queryKeys.core.permissionMatrix, queryFn: () => api.fetchPermissionMatrix(c()) });
export const useClassSections = (classId: string | null) => {
  const yearId = useCurrentYearId();
  return useQuery({
    queryKey: queryKeys.core.classSections(classId, yearId),
    queryFn: () => api.fetchClassSections(c(), classId as string, yearId as string),
    enabled: !!classId && !!yearId,
  });
};

function useMut<T>(fn: (v: T) => Promise<unknown>, keys: readonly (readonly unknown[])[]) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => keys.forEach((queryKey) => qc.invalidateQueries({ queryKey })) });
}

export const useUpdateInstitution = () => useMut((p: RpcPayload) => api.updateInstitution(c(), p), [queryKeys.core.institution]);
export const useSaveSetting = (key: string, scope: string) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (value: RpcPayload) => api.saveSetting(c(), key, scope, value), onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.core.setting(key, scope) }) });
};
export const useUpsertClass = () => useMut((p: RpcPayload) => api.upsertClass(c(), p), [queryKeys.core.classes]);
export const useDeleteClass = () => useMut((id: string) => api.deleteClass(c(), id), [queryKeys.core.classes]);
export const useUpsertSubject = () => useMut((p: RpcPayload) => api.upsertSubject(c(), p), [queryKeys.core.subjects]);
export const useDeleteSubject = () => useMut((id: string) => api.deleteSubject(c(), id), [queryKeys.core.subjects]);
export const useUpsertGroup = () => useMut((p: RpcPayload) => api.upsertSubjectGroup(c(), p), [queryKeys.core.groups]);
export const useDeleteGroup = () => useMut((id: string) => api.deleteSubjectGroup(c(), id), [queryKeys.core.groups]);
export const useUpsertScheme = () => useMut((p: RpcPayload) => api.upsertGradeScheme(c(), p), [queryKeys.core.schemes]);
export const useDeleteScheme = () => useMut((id: string) => api.deleteGradeScheme(c(), id), [queryKeys.core.schemes]);
export const useUpsertSignature = () => useMut((p: RpcPayload) => api.upsertSignature(c(), p), [queryKeys.core.signatures]);
export const useDeleteSignature = () => useMut((id: string) => api.deleteSignature(c(), id), [queryKeys.core.signatures]);
export const useUpsertClassSection = () => useMut((p: RpcPayload) => api.upsertClassSection(c(), p), [queryKeys.core.classSectionsAll, queryKeys.core.classes]);
export const useDeleteClassSection = () => useMut((id: string) => api.deleteClassSection(c(), id), [queryKeys.core.classSectionsAll, queryKeys.core.classes]);

/**
 * Role assignment and suspension. Both invalidate `myPermissions` as well as
 * the list: an admin who changes their OWN roles must see the rail redraw, and
 * an operator who is not told their access changed will file the bug as "the
 * menu is broken".
 */
export const useSetUserRoles = () =>
  useMut(
    (v: { profileId: string; roleIds: string[] }) => api.setUserRoles(c(), v.profileId, v.roleIds),
    [queryKeys.core.usersAll, queryKeys.core.myPermissions],
  );
export const useSetUserStatus = () =>
  useMut(
    (v: { profileId: string; status: "active" | "suspended" }) => api.setUserStatus(c(), v.profileId, v.status),
    [queryKeys.core.usersAll],
  );
