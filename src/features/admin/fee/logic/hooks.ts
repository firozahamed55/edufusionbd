"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/shared/services/supabase/client";
import * as api from "./api";

const c = () => createClient();
const MIN = 60_000;

export const useFeeHeads = () => useQuery({ queryKey: ["fee", "heads"], queryFn: () => api.fetchFeeHeads(c()), staleTime: 5 * MIN });
export const useAccounts = () => useQuery({ queryKey: ["fee", "accounts"], queryFn: () => api.fetchAccounts(c()), staleTime: 5 * MIN });
export const useFeeMappings = () => useQuery({ queryKey: ["fee", "mappings"], queryFn: () => api.fetchFeeMappings(c()) });

export const useStudentInvoices = (studentId: string | null) =>
  useQuery({ queryKey: ["fee", "invoices", studentId], queryFn: () => api.fetchStudentInvoices(c(), studentId as string), enabled: !!studentId });

export const useStudentProfile = (studentId: string | null) =>
  useQuery({ queryKey: ["fee", "profile", studentId], queryFn: () => api.fetchStudentProfile(c(), studentId as string), enabled: !!studentId });

export const useUnpaidBySection = (sectionId: string | null) =>
  useQuery({ queryKey: ["fee", "unpaid-section", sectionId], queryFn: () => api.fetchUnpaidBySection(c(), sectionId as string), enabled: !!sectionId });

export const useUnpaidByInstitute = () => useQuery({ queryKey: ["fee", "unpaid-institute"], queryFn: () => api.fetchUnpaidByInstitute(c()) });

export const useAppliedFees = () => useQuery({ queryKey: ["fee", "applied"], queryFn: () => api.fetchAppliedFees(c()) });

export const useDigitalTransactions = () => useQuery({ queryKey: ["fee", "digital"], queryFn: () => api.fetchDigitalTransactions(c()) });

export const useIncomeStatement = (from: string, to: string, enabled: boolean) =>
  useQuery({ queryKey: ["fee", "income", from, to], queryFn: () => api.fetchIncomeStatement(c(), from, to), enabled });

export function useCollectFee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: api.CollectPayload) => api.collectFee(c(), payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fee"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpsertFeeMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: api.FeeMappingPayload) => api.upsertFeeMapping(c(), payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fee", "mappings"] }),
  });
}

export function useDeleteFeeMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteFeeMapping(c(), id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fee", "mappings"] }),
  });
}

export function useDeleteFeeInvoices() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => api.deleteFeeInvoices(c(), ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fee"] }),
  });
}
