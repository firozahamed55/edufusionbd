"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/shared/services/supabase/client";
import { fetchDashboard } from "./api";

/** Live admin dashboard KPIs + recent notices from Supabase (RLS-scoped). */
export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard", "overview"],
    queryFn: () => fetchDashboard(createClient()),
  });
}
