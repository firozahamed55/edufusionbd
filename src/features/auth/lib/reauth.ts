import { createClient as createIsolatedClient } from "@supabase/supabase-js";

/**
 * Verify a password WITHOUT disturbing the caller's session (A-5).
 *
 * `/change-password` verified the current password by calling
 * `supabase.auth.signInWithPassword` on the app's own browser client. That
 * client is `createBrowserClient` from @supabase/ssr, which persists to
 * cookies — so a routine "confirm your current password" silently minted a new
 * session and replaced the one the user was already holding. A side effect that
 * large does not belong in a validity check.
 *
 * This runs the same check on a throwaway client configured to persist nothing,
 * refresh nothing and read nothing from the URL. The grant it receives lives in
 * that object and dies with it; the caller's cookies are never touched.
 *
 * Two residuals, stated rather than hidden:
 *
 *   • A wrong guess still consumes a slot in Supabase's per-IP token bucket,
 *     because it IS a real token request. Removing that needs GoTrue's
 *     `reauthenticate()` flow, which delivers a code out of band — i.e. the SMS
 *     provider that phone-identity accounts are already waiting on (A-2).
 *   • The issued refresh token is not revoked, because GoTrue has no scope that
 *     revokes one session without touching the others: `signOut({scope:
 *     "global"})` would sign the user out of every device they own, which is a
 *     far worse outcome than an unused token expiring on its own.
 */
export async function verifyPassword(email: string, password: string): Promise<boolean> {
  const probe = createIsolatedClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        // Without this the probe and the real client share a storage key even
        // with persistSession off, and a future @supabase/ssr that writes on
        // sign-in would clobber the live session anyway.
        storageKey: "edufusionbd-reauth-probe",
      },
    },
  );
  const { error } = await probe.auth.signInWithPassword({ email, password });
  return !error;
}
