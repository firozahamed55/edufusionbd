/**
 * Account security data access — MFA, sessions, security events, own profile
 * (SRA B-2, B-3, B-4).
 *
 * TOTP itself is entirely Supabase's (`auth.mfa.*`); this module only wraps it
 * so the screens have one vocabulary.
 *
 * WHY `shared/services` AND NOT `features/auth`. Both the auth pages and the
 * admin My Account screen need it, and `boundaries/dependencies` forbids one
 * feature importing another — correctly. Account security is cross-cutting
 * infrastructure in the same way `academicYear` and `lookups` are. Everything Supabase does NOT model —
 * recovery codes, an admin path to clear a factor, a readable view of
 * `auth.sessions` — goes through the RPCs added in migration 20260801094000.
 */
import type { BrowserClient } from "@/shared/services/supabase/types";

const num = (v: unknown): number => Number(v ?? 0);
const str = (v: unknown): string | null => (v == null ? null : String(v));

/* -------------------------------------------------------------------- MFA */

export type MfaFactor = {
  id: string;
  friendlyName: string | null;
  status: "verified" | "unverified";
  createdAt: string;
};

export async function listFactors(s: BrowserClient): Promise<MfaFactor[]> {
  const { data, error } = await s.auth.mfa.listFactors();
  if (error) throw error;
  return (data?.all ?? []).map((f) => ({
    id: f.id,
    friendlyName: f.friendly_name ?? null,
    status: f.status as MfaFactor["status"],
    createdAt: f.created_at,
  }));
}

export type Enrolment = { factorId: string; qrSvg: string; secret: string; uri: string };

/**
 * Start enrolment. Returns the QR (as an SVG string Supabase renders for us)
 * AND the raw secret, because A-0.7's own accessibility standard applies here:
 * a QR alone is unusable to anyone entering the secret by hand on a desktop
 * authenticator, or to a screen-reader user.
 */
export async function enrollTotp(s: BrowserClient, friendlyName: string): Promise<Enrolment> {
  const { data, error } = await s.auth.mfa.enroll({ factorType: "totp", friendlyName });
  if (error) throw error;
  return {
    factorId: data.id,
    qrSvg: data.totp.qr_code,
    secret: data.totp.secret,
    uri: data.totp.uri,
  };
}

/** Verify a 6-digit code against a factor — used for both enrolment and challenge. */
export async function verifyTotp(s: BrowserClient, factorId: string, code: string): Promise<void> {
  const { data: challenge, error: cErr } = await s.auth.mfa.challenge({ factorId });
  if (cErr) throw cErr;
  const { error } = await s.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
  if (error) throw error;
}

export async function unenroll(s: BrowserClient, factorId: string): Promise<void> {
  const { error } = await s.auth.mfa.unenroll({ factorId });
  if (error) throw error;
}

/**
 * Whether this session has actually satisfied MFA.
 *
 * `aal2` means the second factor was presented in THIS session. Reading the
 * factor list is not the same question: an enrolled user whose session is
 * still `aal1` has not proven anything yet.
 */
export async function assuranceLevel(
  s: BrowserClient,
): Promise<{ current: string | null; next: string | null }> {
  const { data, error } = await s.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw error;
  return { current: data.currentLevel, next: data.nextLevel };
}

/* --------------------------------------------------------- recovery codes */

export async function generateRecoveryCodes(s: BrowserClient): Promise<string[]> {
  const { data, error } = await s.rpc("fn_generate_recovery_codes");
  if (error) throw new Error(error.message);
  return (data as string[] | null) ?? [];
}

export async function recoveryCodeCount(s: BrowserClient): Promise<number> {
  const { data, error } = await s.rpc("fn_recovery_code_count");
  if (error) throw new Error(error.message);
  return num(data);
}

export async function consumeRecoveryCode(s: BrowserClient, code: string): Promise<boolean> {
  const { data, error } = await s.rpc("fn_consume_recovery_code", { p_code: code });
  if (error) throw new Error(error.message);
  return data === true;
}

export async function adminResetMfa(s: BrowserClient, profileId: string, reason: string): Promise<void> {
  const { error } = await s.rpc("fn_admin_reset_mfa", { p_profile_id: profileId, p_reason: reason });
  if (error) throw new Error(error.message);
}

/* --------------------------------------------------------------- sessions */

export type SessionRow = {
  id: string;
  created_at: string;
  last_active: string;
  user_agent: string | null;
  ip: string | null;
  current: boolean;
};

export async function fetchSessions(s: BrowserClient): Promise<SessionRow[]> {
  const { data, error } = await s.rpc("fn_my_sessions");
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    created_at: String(r.created_at),
    last_active: String(r.last_active),
    user_agent: str(r.user_agent),
    ip: str(r.ip),
    current: !!r.current,
  }));
}

export async function revokeSession(s: BrowserClient, sessionId: string | null): Promise<number> {
  const { data, error } = await s.rpc("fn_revoke_session", { p_session_id: sessionId ?? undefined });
  if (error) throw new Error(error.message);
  return num(data);
}

/* -------------------------------------------------------- security events */

export type SecurityEvent = {
  id: string;
  at: string;
  action: string | null;
  ip: string | null;
  user_agent: string | null;
};

export async function fetchSecurityEvents(s: BrowserClient, limit = 50): Promise<SecurityEvent[]> {
  const { data, error } = await s.rpc("fn_my_security_events", { p_limit: limit });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    at: String(r.at),
    action: str(r.action),
    ip: str(r.ip),
    user_agent: str(r.user_agent),
  }));
}

/** Best-effort: a security event that fails to record must not fail the action
 *  it describes. Signing in still succeeded. */
export async function recordSecurityEvent(s: BrowserClient, action: string): Promise<void> {
  await s.rpc("fn_record_security_event", { p_action: action });
}

/* ---------------------------------------------------------------- profile */

export type MyProfile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  last_login_at: string | null;
  roles: string[];
};

export async function fetchMyProfile(s: BrowserClient): Promise<MyProfile | null> {
  const { data, error } = await s.rpc("fn_my_profile");
  if (error) throw new Error(error.message);
  const r = (data ?? {}) as Record<string, unknown>;
  if (!r.id) return null;
  return {
    id: String(r.id),
    full_name: str(r.full_name),
    phone: str(r.phone),
    email: str(r.email),
    status: String(r.status ?? "active"),
    last_login_at: str(r.last_login_at),
    roles: ((r.roles ?? []) as unknown[]).map(String),
  };
}

export async function updateMyProfile(
  s: BrowserClient,
  payload: { full_name?: string; phone?: string },
): Promise<void> {
  const { error } = await s.rpc("fn_update_my_profile", { payload });
  if (error) throw new Error(error.message);
}

/**
 * Step-up re-authentication (SRA B-3, work-package item 9).
 *
 * Re-signs in with the current password to prove the person at the keyboard is
 * the account holder, before a sensitive change. Uses the CURRENT session's
 * email so it cannot be pointed at another account.
 */
export async function reauthenticate(s: BrowserClient, password: string): Promise<boolean> {
  const { data: userData } = await s.auth.getUser();
  const email = userData.user?.email;
  if (!email) return false;
  const { error } = await s.auth.signInWithPassword({ email, password });
  return !error;
}
