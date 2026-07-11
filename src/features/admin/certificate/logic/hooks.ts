"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/shared/services/supabase/client";
import * as api from "./api";

const c = () => createClient();

export const useTemplates = () => useQuery({ queryKey: ["cert", "templates"], queryFn: () => api.fetchTemplates(c()) });
export const useExamOptions = () => useQuery({ queryKey: ["cert", "exams"], queryFn: () => api.fetchExamOptions(c()), staleTime: 60_000 });
export const useIdCardBatches = () => useQuery({ queryKey: ["cert", "id-batches"], queryFn: () => api.fetchIdCardBatches(c()) });
export const useAdmitBatches = () => useQuery({ queryKey: ["cert", "admit-batches"], queryFn: () => api.fetchAdmitBatches(c()) });
export const useTestimonials = () => useQuery({ queryKey: ["cert", "testimonials"], queryFn: () => api.fetchTestimonials(c()) });
export const useTransfers = () => useQuery({ queryKey: ["cert", "transfers"], queryFn: () => api.fetchTransfers(c()) });
export const useSetting = (key: string, scope: string) => useQuery({ queryKey: ["cert", "setting", key, scope], queryFn: () => api.fetchSetting(c(), key, scope) });

function useMut<T>(fn: (v: T) => Promise<unknown>, keys: string[]) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => keys.forEach((k) => qc.invalidateQueries({ queryKey: ["cert", k] })) });
}

export const useUpsertTemplate = () => useMut((p: Record<string, unknown>) => api.upsertTemplate(c(), p), ["templates"]);
export const useDeleteTemplate = () => useMut((id: string) => api.deleteTemplate(c(), id), ["templates"]);
export const useCreateIdBatch = () => useMut((p: Record<string, unknown>) => api.createIdCardBatch(c(), p), ["id-batches"]);
export const useCreateAdmitBatch = () => useMut((p: Record<string, unknown>) => api.createAdmitBatch(c(), p), ["admit-batches"]);
export const useCreateTestimonial = () => useMut((p: Record<string, unknown>) => api.createTestimonial(c(), p), ["testimonials"]);
export const useCreateTransfer = () => useMut((p: Record<string, unknown>) => api.createTransfer(c(), p), ["transfers"]);
export const useSaveSetting = (key: string, scope: string) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (value: Record<string, unknown>) => api.saveSetting(c(), key, scope, value), onSuccess: () => qc.invalidateQueries({ queryKey: ["cert", "setting", key, scope] }) });
};
