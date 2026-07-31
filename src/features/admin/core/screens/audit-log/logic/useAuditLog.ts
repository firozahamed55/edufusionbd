"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/shared/services/supabase/client";
import { queryKeys } from "@/shared/services/queryKeys";
import { fetchAuditLog } from "./api";

export function useAuditLog(params: {
  page: number;
  entity?: string;
  action?: string;
  entityId?: string;
  dir?: "asc" | "desc";
}) {
  return useQuery({
    queryKey: queryKeys.auditLog.list(params),
    queryFn: () => fetchAuditLog(createClient(), params),
  });
}
