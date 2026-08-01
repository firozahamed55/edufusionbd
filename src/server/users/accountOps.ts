import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/shared/services/supabase/server";
import type { Database } from "@/shared/types/database.types";
import {
  inviteUserSchema,
  profileIdSchema,
  type AccountOpError,
} from "@/features/admin/core/logic/userOps";

/**
 * Invite, password reset and session revoke — the three operations that make
 * Users & Roles a user-management screen (audit M-15).
 *
 * WHY A SERVER TIER FOR THESE AND NOT FOR THE OTHER FIFTY WRITES. The rule
 * `sendCampaign.ts` set: route a write here when it needs something a direct
 * RPC cannot give it. Exactly one thing here qualifies — creating an auth user
 * requires GoTrue's admin API and therefore the service-role key, which cannot
 * be in a browser bundle. The other two ride along because they are the same
 * screen's actions with the same shape, not because they need the key:
 * revoking sessions is a `delete from auth.sessions` a SECURITY DEFINER
 * function does directly, and sending a recovery mail uses the anon key.
 *
 * WHERE AUTHORIZATION LIVES. Not here. Every one of these calls a
 * `core.user_manage`-guarded, rate-limited, audit-writing RPC *first*, on the
 * caller's own session, and only then touches GoTrue. That ordering is the
 * whole design: the database decides, this tier executes. A direct
 * `POST /rest/v1/rpc/fn_admin_revoke_sessions` is exactly as protected as this
 * route, which is the property that makes the route safe to add rather than a
 * second, weaker copy of a check.
 *
 * THE SERVICE-ROLE CLIENT IS NEVER USED TO READ OR WRITE APPLICATION DATA.
 * It bypasses RLS completely, so its blast radius is the whole platform, not
 * one tenant. It is used for one call — `auth.admin.inviteUserByEmail` — and
 * nothing else. CI greps for `SUPABASE_SERVICE_ROLE_KEY` outside `src/server/`
 * and fails the build if it finds any, which is why this constant lives here
 * and not in `shared/services/supabase`.
 */

export type AccountOpResult<T> = ({ ok: true } & T) | ({ ok: false } & AccountOpError);

/**
 * SQLSTATEs the guarded RPCs raise, mapped to the vocabulary the screen reads.
 * `42501` is `require_permission`'s; `RLIM1` is `check_rate_limit`'s; the
 * `INV*` codes are this migration's own.
 */
function classify(code: string | undefined, message: string): AccountOpError {
  switch (code) {
    case "42501":
      return { kind: "forbidden", message };
    case "RLIM1":
      return { kind: "rate_limited", message };
    case "INV02":
    case "INV03":
    case "23505":
      return { kind: "duplicate", message };
    case "INV01":
    case "RBAC2":
      return { kind: "validation", message };
    default:
      return { kind: "unknown", message };
  }
}

type Postgrestish = { code?: string; message: string };
const failed = (e: Postgrestish) => ({ ok: false as const, ...classify(e.code, e.message) });

/**
 * A client authenticated as the project's service role.
 *
 * `persistSession: false` because there is no session to persist — this client
 * is created per request, makes one admin call and is discarded. Leaving it on
 * makes GoTrue write to a storage adapter that does not exist on the server.
 */
function serviceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  return createServiceClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/* ------------------------------------------------------------------ invite */

export async function inviteUserUseCase(
  payload: unknown,
  origin: string,
): Promise<AccountOpResult<{ profile_id: string; resend: boolean }>> {
  const parsed = inviteUserSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, kind: "validation", message: parsed.error.issues[0]?.message ?? "Invalid payload" };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, kind: "unauthenticated", message: "Sign in required" };

  // Step 1 — the database decides. Permission, rate limit, address shape and
  // "is this already an active account" are all settled before a single mail
  // is spent, so a refused invite never reaches GoTrue.
  const prepared = await supabase.rpc("fn_prepare_user_invite", { payload: parsed.data });
  if (prepared.error) return failed(prepared.error);

  const plan = prepared.data as {
    email: string;
    existing_profile: string | null;
    resend: boolean;
  };

  // Step 2 — GoTrue. Two paths, because `inviteUserByEmail` refuses an address
  // that already has an auth user, and "resend" means exactly that case: an
  // account invited earlier that never signed in. A recovery mail lands them
  // on the same set-your-password screen, which is the outcome the operator
  // asked for; calling it an invite in the audit row would be a lie, so it is
  // recorded as `invite_resent`.
  let profileId = plan.existing_profile;
  if (plan.resend && profileId) {
    const { error } = await supabase.auth.resetPasswordForEmail(plan.email, {
      redirectTo: `${origin}/reset-password`,
    });
    if (error) return { ok: false, kind: "unknown", message: error.message };
  } else {
    const admin = serviceClient();
    const { data, error } = await admin.auth.admin.inviteUserByEmail(plan.email, {
      redirectTo: `${origin}/first-login-setup`,
      data: {
        full_name: parsed.data.full_name,
        // Carried for the mail template's benefit only. Nothing authorizes off
        // user metadata — it is user-writable once they hold a session.
        invite_message: parsed.data.message ?? null,
      },
    });
    if (error) {
      const duplicate = /already (been )?registered|already exists/i.test(error.message);
      return { ok: false, kind: duplicate ? "duplicate" : "unknown", message: error.message };
    }
    profileId = data.user?.id ?? null;
  }
  if (!profileId) return { ok: false, kind: "unknown", message: "The invitation produced no account" };

  // Step 3 — record it. Institution, name, phone, email, roles, provenance and
  // the audit row, all under the caller's own permission guard.
  const completed = await supabase.rpc("fn_complete_user_invite", {
    payload: {
      profile_id: profileId,
      full_name: parsed.data.full_name,
      phone: parsed.data.phone ?? null,
      email: plan.email,
      role_ids: parsed.data.role_ids,
      resend: plan.resend,
    },
  });
  if (completed.error) return failed(completed.error);

  return { ok: true, profile_id: profileId, resend: plan.resend };
}

/* ---------------------------------------------------------- password reset */

export async function resetPasswordUseCase(
  payload: unknown,
  origin: string,
): Promise<AccountOpResult<{ email: string }>> {
  const parsed = profileIdSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, kind: "validation", message: parsed.error.issues[0]?.message ?? "Invalid payload" };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, kind: "unauthenticated", message: "Sign in required" };

  // Returns the address, having first checked the permission, the rate limit
  // and that the target is in the caller's institution. `resetPasswordForEmail`
  // deliberately cannot report an unknown address — right for the public
  // forgot-password form, useless to an administrator who needs to be told the
  // person they clicked on has no email on file.
  const prepared = await supabase.rpc("fn_admin_prepare_password_reset", { p_profile_id: parsed.data.profile_id });
  if (prepared.error) return failed(prepared.error);

  const email = prepared.data as string;
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/reset-password`,
  });
  if (error) return { ok: false, kind: "unknown", message: error.message };

  return { ok: true, email };
}

/* --------------------------------------------------------- revoke sessions */

export async function revokeSessionsUseCase(
  payload: unknown,
): Promise<AccountOpResult<{ revoked: number }>> {
  const parsed = profileIdSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, kind: "validation", message: parsed.error.issues[0]?.message ?? "Invalid payload" };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, kind: "unauthenticated", message: "Sign in required" };

  // Entirely the database's work — no service-role key involved. It lives on
  // this route because it belongs to the same screen and the same error shape,
  // not because the browser could not have called the RPC itself.
  const { data, error } = await supabase.rpc("fn_admin_revoke_sessions", { p_profile_id: parsed.data.profile_id });
  if (error) return failed(error);

  return { ok: true, revoked: (data as number) ?? 0 };
}
