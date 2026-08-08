/**
 * Use case behind `POST /api/admin/users/invite` — the second write routed
 * through the server tier, and the one the whole access-control story was
 * waiting on (settings audit M-15).
 *
 * WHY THIS ONE NEEDS A ROUTE. `sendCampaign.ts` sets the bar: route a write
 * here only when it needs something a direct, permission-guarded RPC cannot
 * give it. Creating an auth user is exactly that — it requires the
 * service-role key, which must never reach the browser bundle. Everything else
 * this feature does (revoking sessions, authorizing a password reset,
 * suspending) stayed as guarded RPCs, because `auth.sessions` is reachable from
 * a SECURITY DEFINER function and `resetPasswordForEmail` is an unauthenticated
 * GoTrue endpoint. One route, not three.
 *
 * ORDER OF OPERATIONS, AND WHY IT MATTERS.
 *   1. `fn_invite_user_precheck` — permission, rate limit, email shape,
 *      duplicate check. Runs as the CALLER, so `core.user_manage` and the
 *      tenant scope are enforced by the same guard every other write uses, not
 *      re-implemented in TypeScript against the service-role key.
 *   2. `auth.admin.inviteUserByEmail` — creates the user and sends the mail.
 *      The `on_auth_user_created` trigger makes a profile row with no
 *      institution.
 *   3. `fn_complete_user_invite` — claims that row for the caller's
 *      institution, sets the roles, writes the audit entry. Also as the caller.
 *   4. If (3) fails, the auth user is deleted. An account that can sign in but
 *      belongs to no institution is worse than no account: `current_institution_id()`
 *      returns null for it, so it lands in an admin shell with every query empty.
 *
 * The service-role key is used for exactly one call, and never to bypass a
 * permission check.
 */
import { createClient as createSessionClient } from "@/shared/services/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/types/database.types";
import { inviteUserSchema, type InviteUserPayload } from "@/features/admin/core/logic/users";

export type InviteFailureKind =
  | "validation"
  | "rate_limited"
  | "forbidden"
  | "unauthenticated"
  | "conflict"
  | "unknown";

export type InviteUserResult =
  | { ok: true; profileId: string }
  | { ok: false; kind: InviteFailureKind; message: string };

/** PostgREST surfaces the RPC's SQLSTATE; these are the ones the RPCs raise. */
function kindFor(code: string | undefined): InviteFailureKind {
  switch (code) {
    case "42501":
      return "forbidden";
    case "RLIM1":
      return "rate_limited";
    case "INV01":
      return "validation";
    case "INV02":
    case "INV03":
      return "conflict";
    default:
      return "unknown";
  }
}

export async function inviteUserUseCase(payload: unknown): Promise<InviteUserResult> {
  const parsed = inviteUserSchema.safeParse(payload as InviteUserPayload);
  if (!parsed.success) {
    return { ok: false, kind: "validation", message: parsed.error.issues[0]?.message ?? "Invalid payload" };
  }
  const input = parsed.data;

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    // Fail loudly rather than half-inviting. A missing key is a deployment
    // fault, not a user error.
    return { ok: false, kind: "unknown", message: "Invitations are not configured on this deployment" };
  }

  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, kind: "unauthenticated", message: "Sign in required" };

  const pre = await supabase.rpc("fn_invite_user_precheck", { p_email: input.email });
  if (pre.error) {
    return { ok: false, kind: kindFor(pre.error.code), message: pre.error.message };
  }

  const admin = createServiceClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/reset-password`;
  const created = await admin.auth.admin.inviteUserByEmail(input.email, {
    data: { full_name: input.full_name },
    redirectTo: redirectTo || undefined,
  });
  if (created.error || !created.data.user) {
    return { ok: false, kind: "unknown", message: created.error?.message ?? "Could not send the invitation" };
  }

  const profileId = created.data.user.id;
  const done = await supabase.rpc("fn_complete_user_invite", {
    payload: {
      profile_id: profileId,
      full_name: input.full_name,
      phone: input.phone ?? null,
      email: input.email,
      role_ids: input.role_ids,
    },
  });
  if (done.error) {
    // Compensate: no orphan that can sign in with no institution.
    await admin.auth.admin.deleteUser(profileId);
    return { ok: false, kind: kindFor(done.error.code), message: done.error.message };
  }

  return { ok: true, profileId };
}
