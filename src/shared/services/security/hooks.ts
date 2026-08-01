"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/shared/services/supabase/client";
import { queryKeys } from "@/shared/services/queryKeys";
import * as api from "./api";

const c = () => createClient();

export const useMfaFactors = () =>
  useQuery({ queryKey: queryKeys.security.factors, queryFn: () => api.listFactors(c()) });

export const useAssuranceLevel = () =>
  useQuery({ queryKey: queryKeys.security.aal, queryFn: () => api.assuranceLevel(c()) });

export const useRecoveryCodeCount = () =>
  useQuery({ queryKey: queryKeys.security.recoveryCount, queryFn: () => api.recoveryCodeCount(c()) });

export const useSessions = () =>
  useQuery({ queryKey: queryKeys.security.sessions, queryFn: () => api.fetchSessions(c()) });

export const useSecurityEvents = (limit = 50) =>
  useQuery({ queryKey: queryKeys.security.events(limit), queryFn: () => api.fetchSecurityEvents(c(), limit) });

export const useMyProfile = () =>
  useQuery({ queryKey: queryKeys.security.myProfile, queryFn: () => api.fetchMyProfile(c()) });

function useMut<T, R>(fn: (v: T) => Promise<R>, keys: readonly (readonly unknown[])[]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => keys.forEach((queryKey) => qc.invalidateQueries({ queryKey })),
  });
}

/** Enrolment is a mutation but its RESULT is the QR the screen must show, so
 *  the caller reads `data` rather than the cache. */
export const useEnrollTotp = () =>
  useMut((name: string) => api.enrollTotp(c(), name), [queryKeys.security.factors]);

export const useVerifyTotp = () =>
  useMut(
    (v: { factorId: string; code: string }) => api.verifyTotp(c(), v.factorId, v.code),
    [queryKeys.security.factors, queryKeys.security.aal],
  );

export const useUnenrollTotp = () =>
  useMut(
    (factorId: string) => api.unenroll(c(), factorId),
    [queryKeys.security.factors, queryKeys.security.aal, queryKeys.security.recoveryCount],
  );

export const useGenerateRecoveryCodes = () =>
  useMut(() => api.generateRecoveryCodes(c()), [queryKeys.security.recoveryCount]);

export const useRevokeSession = () =>
  useMut((sessionId: string | null) => api.revokeSession(c(), sessionId), [queryKeys.security.sessions]);

export const useUpdateMyProfile = () =>
  useMut(
    (payload: { full_name?: string; phone?: string }) => api.updateMyProfile(c(), payload),
    [queryKeys.security.myProfile, queryKeys.admin.me],
  );

export const useAdminResetMfa = () =>
  useMut(
    (v: { profileId: string; reason: string }) => api.adminResetMfa(c(), v.profileId, v.reason),
    [queryKeys.core.usersAll],
  );
