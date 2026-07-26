"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/shared/services/supabase/client";
import { queryKeys } from "@/shared/services/queryKeys";
import { roleFromClaims } from "@/shared/services/supabase/middleware";

export type AdminUser = { name: string; email: string; role?: string; initials: string };

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

/**
 * The signed-in operator (audit T-2 — the shell hardcoded "AD" / "Admin" /
 * "Head Teacher" for every user, forever).
 *
 * `getClaims()` rather than `getUser()`: the project signs JWTs with an
 * asymmetric key, so claims verify locally without a round trip to GoTrue on
 * every shell render. The role comes from `app_metadata` only — `user_metadata`
 * is self-writable and cannot be trusted for authorization display either.
 */
export function useAdminUser() {
  return useQuery({
    queryKey: queryKeys.admin.me,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<AdminUser | null> => {
      const { data } = await createClient().auth.getClaims();
      const claims = data?.claims;
      if (!claims) return null;
      const email = typeof claims.email === "string" ? claims.email : "";
      const meta = claims.user_metadata as Record<string, unknown> | undefined;
      const name =
        (typeof meta?.full_name === "string" && meta.full_name) ||
        (typeof meta?.name === "string" && meta.name) ||
        email.split("@")[0] ||
        "User";
      return { name, email, role: roleFromClaims(claims), initials: initialsOf(name) };
    },
  });
}
