"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/shared/services/supabase/client";
import { queryKeys } from "@/shared/services/queryKeys";
import { fetchAuditLog } from "./api";

export function useAuditLog(page: number, entity?: string) {
  return useQuery({
    queryKey: queryKeys.auditLog.list({ page, entity }),
    queryFn: () => fetchAuditLog(createClient(), { page, entity }),
  });
}
