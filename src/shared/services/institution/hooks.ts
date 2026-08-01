"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/shared/services/supabase/client";
import { queryKeys } from "@/shared/services/queryKeys";

/**
 * The caller's own institution id.
 *
 * Storage RLS on `institution-assets` checks the FIRST path segment against
 * the caller's institution, so every upload call site has to pass its own —
 * never a guessed one (see `shared/lib/institutionAssets.ts`). Feature modules
 * cannot import `features/admin/core`'s `useInstitution` (the boundaries rule
 * allows a feature to reach only `shared` and itself), so the id lives here.
 *
 * Deliberately its own narrow query rather than reusing
 * `queryKeys.core.institution`: that key caches the full settings row under a
 * specific column list, and two queryFns writing different shapes to one key
 * is a bug that only shows up in whichever screen mounts second.
 */
export function useInstitutionId() {
  return useQuery({
    queryKey: queryKeys.institution.currentId,
    staleTime: 30 * 60_000,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await createClient().from("institution").select("id").limit(1).maybeSingle();
      if (error) throw error;
      return (data as { id: string } | null)?.id ?? null;
    },
  });
}
