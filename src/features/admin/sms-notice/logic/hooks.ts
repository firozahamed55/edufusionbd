"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/shared/services/supabase/client";
import type { RpcPayload } from "@/shared/services/supabase/types";
import * as api from "./api";
import { queryKeys } from "@/shared/services/queryKeys";

const c = () => createClient();

export const useSmsAccount = () => useQuery({ queryKey: queryKeys.sms.account, queryFn: () => api.fetchSmsAccount(c()) });
export const usePackages = () => useQuery({ queryKey: queryKeys.sms.packages, queryFn: () => api.fetchPackages(c()) });
export const useTemplates = () => useQuery({ queryKey: queryKeys.sms.templates, queryFn: () => api.fetchTemplates(c()) });
export const useCampaignTotals = () => useQuery({ queryKey: queryKeys.sms.campaignTotals, queryFn: () => api.fetchCampaignTotals(c()) });
export const useCampaigns = (page = 1) =>
  useQuery({ queryKey: queryKeys.sms.campaigns(page), queryFn: () => api.fetchCampaigns(c(), page), placeholderData: (prev) => prev });
export const useNotices = (page = 1) =>
  useQuery({ queryKey: queryKeys.sms.notices(page), queryFn: () => api.fetchNotices(c(), page), placeholderData: (prev) => prev });

function useMut<T>(fn: (v: T) => Promise<unknown>, keys: readonly (readonly unknown[])[]) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => keys.forEach((queryKey) => qc.invalidateQueries({ queryKey })) });
}

export const useSendCampaign = () => useMut((p: api.SendCampaignPayload) => api.sendCampaign(c(), p), [queryKeys.sms.campaignsAll, queryKeys.sms.campaignTotals, queryKeys.sms.account]);
export const usePurchasePackage = () => useMut((id: string) => api.purchasePackage(c(), id), [queryKeys.sms.account]);
export const useUpsertTemplate = () => useMut((p: RpcPayload) => api.upsertTemplate(c(), p), [queryKeys.sms.templates]);
export const useDeleteTemplate = () => useMut((id: string) => api.deleteTemplate(c(), id), [queryKeys.sms.templates]);
export const useUpsertNotice = () => useMut((p: RpcPayload) => api.upsertNotice(c(), p), [queryKeys.sms.noticesAll]);
export const useDeleteNotice = () => useMut((id: string) => api.deleteNotice(c(), id), [queryKeys.sms.noticesAll]);
