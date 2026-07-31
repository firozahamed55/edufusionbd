"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/shared/services/supabase/client";
import * as api from "./api";
import { queryKeys } from "@/shared/services/queryKeys";
import { useCurrentYearId } from "@/shared/services/academicYear/hooks";

const c = () => createClient();
const MIN = 60_000;

export const useFeeHeads = () => useQuery({ queryKey: queryKeys.fee.heads, queryFn: () => api.fetchFeeHeads(c()), staleTime: 5 * MIN });
export const useAccounts = () => useQuery({ queryKey: queryKeys.fee.accounts, queryFn: () => api.fetchAccounts(c()), staleTime: 5 * MIN });
export const useFeeMappings = () => useQuery({ queryKey: queryKeys.fee.mappings, queryFn: () => api.fetchFeeMappings(c()) });

export const useStudentInvoices = (studentId: string | null) => {
  const yearId = useCurrentYearId();
  return useQuery({
    queryKey: queryKeys.fee.invoices(studentId, yearId),
    queryFn: () => api.fetchStudentInvoices(c(), studentId as string, yearId as string),
    enabled: !!studentId && !!yearId,
  });
};

export const useStudentProfile = (studentId: string | null) =>
  useQuery({ queryKey: queryKeys.fee.profile(studentId), queryFn: () => api.fetchStudentProfile(c(), studentId as string), enabled: !!studentId });

export const useUnpaidBySection = (sectionId: string | null) =>
  useQuery({ queryKey: queryKeys.fee.unpaidSection(sectionId), queryFn: () => api.fetchUnpaidBySection(c(), sectionId as string), enabled: !!sectionId });

export const useUnpaidByInstitute = () => useQuery({ queryKey: queryKeys.fee.unpaidInstitute, queryFn: () => api.fetchUnpaidByInstitute(c()) });

export const useAppliedFees = (params: {
  page: number;
  q?: string;
  status?: string;
  sort?: { key: string; dir: "asc" | "desc" } | null;
}) => {
  const yearId = useCurrentYearId();
  return useQuery({
    queryKey: queryKeys.fee.applied({ ...params, sort: params.sort ? `${params.sort.key}:${params.sort.dir}` : "" }, yearId),
    queryFn: () => api.fetchAppliedFees(c(), yearId as string, params),
    enabled: !!yearId,
    placeholderData: (prev) => prev,
  });
};

export const useDigitalTransactions = (page: number) =>
  useQuery({ queryKey: queryKeys.fee.digital(page), queryFn: () => api.fetchDigitalTransactions(c(), { page }), placeholderData: (prev) => prev });

export const useDigitalTransactionStats = () =>
  useQuery({ queryKey: queryKeys.fee.digitalStats, queryFn: () => api.fetchDigitalTransactionStats(c()) });

export const useIncomeStatement = (from: string, to: string, enabled: boolean) =>
  useQuery({ queryKey: queryKeys.fee.income(from, to), queryFn: () => api.fetchIncomeStatement(c(), from, to), enabled });

export function useCollectFee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: api.CollectPayload) => api.collectFee(c(), payload),
    // Audit A-M7. This used to invalidate `["fee"]`, i.e. all eleven fee
    // queries: fee heads, accounts, mappings, every student's invoices, both
    // unpaid reports, the digital list, its stats and the income statement.
    // One click fired eight refetches, which is the likeliest single cause of
    // "the APIs are not smooth". A payment changes that student's invoices,
    // what is still owed, and the money totals — nothing else. The reference
    // lists carry a 5-minute staleTime for exactly this reason.
    // `CollectPayload` carries the invoice id, not the student id, so the
    // invoice lists are invalidated by prefix rather than per student.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.fee.invoicesAll });
      qc.invalidateQueries({ queryKey: queryKeys.fee.unpaidSectionAll });
      qc.invalidateQueries({ queryKey: queryKeys.fee.unpaidInstitute });
      qc.invalidateQueries({ queryKey: queryKeys.fee.appliedAll });
      qc.invalidateQueries({ queryKey: queryKeys.fee.digitalAll });
      qc.invalidateQueries({ queryKey: queryKeys.fee.incomeAll });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}

export function useUpsertFeeMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: api.FeeMappingPayload) => api.upsertFeeMapping(c(), payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.fee.mappings }),
  });
}

export function useDeleteFeeMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteFeeMapping(c(), id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.fee.mappings }),
  });
}

export function useDeleteFeeInvoices() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => api.deleteFeeInvoices(c(), ids),
    // Voiding invoices moves what is owed and what has been billed, but not
    // the fee heads / accounts / mapping reference lists.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.fee.invoicesAll });
      qc.invalidateQueries({ queryKey: queryKeys.fee.unpaidSectionAll });
      qc.invalidateQueries({ queryKey: queryKeys.fee.unpaidInstitute });
      qc.invalidateQueries({ queryKey: queryKeys.fee.appliedAll });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}
