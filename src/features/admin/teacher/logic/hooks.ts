"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/shared/services/supabase/client";
import { queryKeys } from "@/shared/services/queryKeys";
import {
  fetchTeacherDetail,
  fetchTeacherOptions,
  registerTeacher,
  updateTeacher,
  type TeacherWritePayload,
} from "./api";

const c = () => createClient();

/** Existing-teacher options for the update-profile picker. */
export function useTeacherOptions() {
  return useQuery({
    queryKey: ["teachers", "options"],
    queryFn: () => fetchTeacherOptions(c()),
    staleTime: 60_000,
  });
}

/** One teacher hydrated into form values (enabled only when an id is chosen). */
export function useTeacherDetail(id: string | null) {
  return useQuery({
    queryKey: queryKeys.teachers.detail(id ?? ""),
    queryFn: () => fetchTeacherDetail(c(), id as string),
    enabled: !!id,
  });
}

export function useRegisterTeacher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: TeacherWritePayload) => registerTeacher(c(), payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.teachers.all });
      qc.invalidateQueries({ queryKey: ["teachers", "options"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpdateTeacher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: TeacherWritePayload & { id: string }) => updateTeacher(c(), payload),
    onSuccess: (_id, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.teachers.all });
      qc.invalidateQueries({ queryKey: ["teachers", "options"] });
      qc.invalidateQueries({ queryKey: queryKeys.teachers.detail(vars.id) });
    },
  });
}
