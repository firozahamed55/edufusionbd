/**
 * Post-authentication routing by role (audit 7.1). The auth *screens* are
 * role-agnostic — a school admin, a teacher and a parent all authenticate
 * through the same Supabase flow — but each role lands in its own app after
 * a successful sign-in. Keeping this in one place means every auth screen
 * (login, OTP, first-login) redirects consistently.
 */
export type Role = "admin" | "teacher" | "parent";

const HOME: Record<Role, string> = {
  admin: "/admin/dashboard",
  teacher: "/admin/dashboard", // teacher app not built yet → admin fallback
  parent: "/parent",
};

/** Bilingual role names — shared by the Role Selection screen and the login header. */
export const ROLE_LABELS: Record<Role, { bn: string; en: string }> = {
  admin: { bn: "প্রশাসক", en: "Administrator" },
  teacher: { bn: "শিক্ষক", en: "Teacher" },
  parent: { bn: "অভিভাবক", en: "Parent" },
};

/** Resolve the landing route for a role, falling back to the admin dashboard. */
export function roleHome(role?: string | null): string {
  if (role && role in HOME) return HOME[role as Role];
  return HOME.admin;
}

/** Narrow an untrusted string (e.g. a `?role=` query param) to a known Role. */
export function isRole(value?: string | null): value is Role {
  return value === "admin" || value === "teacher" || value === "parent";
}

/**
 * Sanitize a post-login `?redirect=` target: only same-origin absolute paths
 * ("/admin/…") are allowed. Rejects "//evil.com" and "http://…" so a crafted
 * link can't turn our login into an open redirect.
 */
export function safeInternalPath(raw?: string | null): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}
