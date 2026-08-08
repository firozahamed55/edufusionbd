"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { createClient } from "@/shared/services/supabase/client";
import { queryKeys } from "@/shared/services/queryKeys";
import { fetchAuditActors, fetchAuditLog, revealAuditRecord, type AuditQuery } from "./api";

export function useAuditLog(params: AuditQuery) {
  return useQuery({
    queryKey: queryKeys.auditLog.list(params),
    queryFn: () => fetchAuditLog(createClient(), params),
  });
}

/** Long staleTime: the set of people who have ever changed something moves
 *  monthly, and this drives a filter dropdown on every render. */
export function useAuditActors() {
  return useQuery({
    queryKey: queryKeys.auditLog.actors,
    queryFn: () => fetchAuditActors(createClient()),
    staleTime: 5 * 60_000,
  });
}

/** Not a query: revealing is an action, it is logged, and it must not be
 *  replayed by a cache refetch. */
export function useRevealAudit() {
  return useMutation({ mutationFn: (id: string) => revealAuditRecord(createClient(), id) });
}
