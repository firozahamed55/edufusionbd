"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/shared/services/supabase/client";
import type { RpcPayload } from "@/shared/services/supabase/types";
import * as api from "./api";
import { queryKeys } from "@/shared/services/queryKeys";
import { useCurrentYearId } from "@/shared/services/academicYear/hooks";

const c = () => createClient();

export const useTemplates = () => useQuery({ queryKey: queryKeys.cert.templates, queryFn: () => api.fetchTemplates(c()) });
export const useExamOptions = () => {
  const yearId = useCurrentYearId();
  return useQuery({ queryKey: queryKeys.cert.exams(yearId), queryFn: () => api.fetchExamOptions(c(), yearId as string), enabled: !!yearId, staleTime: 60_000 });
};
export const useIdCardBatches = () => useQuery({ queryKey: queryKeys.cert.idBatches, queryFn: () => api.fetchIdCardBatches(c()) });
export const useAdmitBatches = () => useQuery({ queryKey: queryKeys.cert.admitBatches, queryFn: () => api.fetchAdmitBatches(c()) });
export const useTestimonials = () => useQuery({ queryKey: queryKeys.cert.testimonials, queryFn: () => api.fetchTestimonials(c()) });
export const useTransfers = () => useQuery({ queryKey: queryKeys.cert.transfers, queryFn: () => api.fetchTransfers(c()) });
export const useSetting = (key: string, scope: string) => useQuery({ queryKey: queryKeys.cert.setting(key, scope), queryFn: () => api.fetchSetting(c(), key, scope) });

function useMut<T>(fn: (v: T) => Promise<unknown>, keys: readonly (readonly unknown[])[]) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => keys.forEach((queryKey) => qc.invalidateQueries({ queryKey })) });
}

export const useUpsertTemplate = () => useMut((p: RpcPayload) => api.upsertTemplate(c(), p), [queryKeys.cert.templates]);
export const useDeleteTemplate = () => useMut((id: string) => api.deleteTemplate(c(), id), [queryKeys.cert.templates]);
export const useCreateIdBatch = () => useMut((p: RpcPayload) => api.createIdCardBatch(c(), p), [queryKeys.cert.idBatches]);
export const useCreateAdmitBatch = () => useMut((p: RpcPayload) => api.createAdmitBatch(c(), p), [queryKeys.cert.admitBatches]);
export const useCreateTestimonial = () => useMut((p: RpcPayload) => api.createTestimonial(c(), p), [queryKeys.cert.testimonials]);
export const useCreateTransfer = () => useMut((p: RpcPayload) => api.createTransfer(c(), p), [queryKeys.cert.transfers]);
export const useSaveSetting = (key: string, scope: string) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (value: RpcPayload) => api.saveSetting(c(), key, scope, value), onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.cert.setting(key, scope) }) });
};
