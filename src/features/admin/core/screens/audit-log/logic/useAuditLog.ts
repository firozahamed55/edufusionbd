"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { createClient } from "@/shared/services/supabase/client";
import { queryKeys } from "@/shared/services/queryKeys";
import { fetchAuditActors, fetchAuditLog, logAuditReveal, type AuditLogParams } from "./api";

export function useAuditLog(params: AuditLogParams) {
  return useQuery({
    queryKey: queryKeys.auditLog.list(params),
    queryFn: () => fetchAuditLog(createClient(), params),
  });
}

/**
 * The people who appear in the log. Long staleTime: the set of actors changes
 * when someone new makes their first change, which is not something worth
 * re-asking on every filter keystroke.
 */
export function useAuditActors() {
  return useQuery({
    queryKey: queryKeys.auditLog.actors,
    queryFn: () => fetchAuditActors(createClient()),
    staleTime: 5 * 60_000,
  });
}

/** Reveal is itself an event (audit S-11.4) — the RPC writes it before the UI unmasks. */
export function useLogAuditReveal() {
  return useMutation({ mutationFn: (auditId: string) => logAuditReveal(createClient(), auditId) });
}
