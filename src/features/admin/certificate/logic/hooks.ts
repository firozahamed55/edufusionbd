"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/shared/services/supabase/client";
import type { RpcPayload } from "@/shared/services/supabase/types";
import * as api from "./api";
import * as docs from "./documents";
import { queryKeys } from "@/shared/services/queryKeys";
import { useCurrentYearId } from "@/shared/services/academicYear/hooks";
import { useT } from "@/shared/i18n/useT";

const c = () => createClient();

function useMut<T>(fn: (v: T) => Promise<unknown>, keys: readonly (readonly unknown[])[]) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => keys.forEach((queryKey) => qc.invalidateQueries({ queryKey })) });
}

export const useTemplates = () => useQuery({ queryKey: queryKeys.cert.templates, queryFn: () => api.fetchTemplates(c()) });
export const useExamOptions = () => {
  const yearId = useCurrentYearId();
  return useQuery({ queryKey: queryKeys.cert.exams(yearId), queryFn: () => api.fetchExamOptions(c(), yearId as string), enabled: !!yearId, staleTime: 60_000 });
};
/**
 * Recent batches with the detail A-7 point 8 asks for: created-by, count,
 * status, and the spec needed to re-resolve the roster for a reprint. The old
 * `fetchIdCardBatches` returned class and roll range only — enough to list, not
 * enough to do anything with.
 */
export const useIdBatchDetails = () => {
  const { isBn } = useT();
  return useQuery({ queryKey: queryKeys.cert.idBatches, queryFn: () => docs.fetchIdBatchDetails(c(), isBn) });
};
export const useAdmitBatchDetails = () => {
  const { isBn } = useT();
  return useQuery({ queryKey: queryKeys.cert.admitBatches, queryFn: () => docs.fetchAdmitBatchDetails(c(), isBn) });
};

/** The roster a batch resolves to — the input to every card template. */
export const useBatchStudents = (spec: docs.BatchSpec | null) => {
  const yearId = useCurrentYearId();
  return useQuery({
    queryKey: queryKeys.documents.batchStudents(spec),
    queryFn: () => docs.fetchBatchStudents(c(), spec as docs.BatchSpec, yearId as string),
    enabled: !!spec && !!yearId,
  });
};

export const useSeatNumbers = (batchId: string | null) =>
  useQuery({
    queryKey: queryKeys.documents.seatNumbers(batchId),
    queryFn: () => docs.fetchSeatNumbers(c(), batchId as string),
    enabled: !!batchId,
  });

export const useExamSubjects = (examId: string | null, classId: string | null) => {
  const { isBn } = useT();
  return useQuery({
    queryKey: queryKeys.cert.examSubjects(examId, classId),
    queryFn: () => docs.fetchExamSubjects(c(), examId as string, classId as string, isBn),
    enabled: !!examId && !!classId,
  });
};

export const useCancelBatch = (kind: "id" | "admit") =>
  useMut(
    (v: { id: string; reason: string }) => docs.cancelBatch(c(), kind, v.id, v.reason),
    [kind === "id" ? queryKeys.cert.idBatches : queryKeys.cert.admitBatches],
  );
export const useTestimonials = () => useQuery({ queryKey: queryKeys.cert.testimonials, queryFn: () => api.fetchTestimonials(c()) });
export const useTransfers = () => useQuery({ queryKey: queryKeys.cert.transfers, queryFn: () => api.fetchTransfers(c()) });
export const useSetting = (key: string, scope: string) => useQuery({ queryKey: queryKeys.cert.setting(key, scope), queryFn: () => api.fetchSetting(c(), key, scope) });

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
