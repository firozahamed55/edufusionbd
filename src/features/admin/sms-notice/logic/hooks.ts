"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/shared/services/supabase/client";
import * as api from "./api";

const c = () => createClient();

export const useSmsAccount = () => useQuery({ queryKey: ["sms", "account"], queryFn: () => api.fetchSmsAccount(c()) });
export const usePackages = () => useQuery({ queryKey: ["sms", "packages"], queryFn: () => api.fetchPackages(c()) });
export const useTemplates = () => useQuery({ queryKey: ["sms", "templates"], queryFn: () => api.fetchTemplates(c()) });
export const useCampaigns = () => useQuery({ queryKey: ["sms", "campaigns"], queryFn: () => api.fetchCampaigns(c()) });
export const useNotices = () => useQuery({ queryKey: ["sms", "notices"], queryFn: () => api.fetchNotices(c()) });

function useMut<T>(fn: (v: T) => Promise<unknown>, keys: string[]) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => keys.forEach((k) => qc.invalidateQueries({ queryKey: ["sms", k] })) });
}

export const useSendCampaign = () => useMut((p: Record<string, unknown>) => api.sendCampaign(c(), p), ["campaigns", "account"]);
export const usePurchasePackage = () => useMut((id: string) => api.purchasePackage(c(), id), ["account"]);
export const useUpsertTemplate = () => useMut((p: Record<string, unknown>) => api.upsertTemplate(c(), p), ["templates"]);
export const useDeleteTemplate = () => useMut((id: string) => api.deleteTemplate(c(), id), ["templates"]);
export const useUpsertNotice = () => useMut((p: Record<string, unknown>) => api.upsertNotice(c(), p), ["notices"]);
export const useDeleteNotice = () => useMut((id: string) => api.deleteNotice(c(), id), ["notices"]);
