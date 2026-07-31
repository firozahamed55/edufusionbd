/**
 * Use case behind `POST /api/v1/sms/send` — the first (and, deliberately,
 * only) write routed through the server tier so far.
 *
 * WHY THIS ONE. The audit (A-H8) names it specifically: "no protection on the
 * SMS send path, which spends real money per message." The rate limit itself
 * lives in `private.fn_send_sms_campaign` (migration
 * `20260726055938_rate_limiting.sql`) — the RPC is the one chokepoint every
 * caller passes through, PostgREST or this route alike, so a direct
 * `POST /rest/v1/rpc/fn_send_sms_campaign` is exactly as protected as this
 * route. What this tier adds on top: a stable JSON error shape (`kind` +
 * localized-ready status codes) instead of a raw PostgrestError, and a home
 * for the next write that needs the same shape — validate → call → typed
 * result — without inventing it again.
 *
 * WHY NOT THE OTHER 51 WRITES TOO. The audit's own architecture note (§3.2):
 * "Reads that are already safe under RLS keep going direct — do not proxy 65
 * queries through Next for symmetry. That would add a network hop and buy
 * nothing." The same reasoning holds for writes that carry no rate-limit or
 * webhook concern: RLS + the permission-guarded RPC (migration
 * `20260726044457_rpc_permission_guards.sql`) already fully authorize them.
 * Route a write here when it needs something a direct RPC call cannot give it
 * — spend limits, third-party webhooks, background work — not by default.
 */
import { createClient } from "@/shared/services/supabase/server";
import {
  sendCampaignSchema,
  type SendCampaignPayload,
} from "@/features/admin/sms-notice/logic/api";

export type SendCampaignResult =
  | { ok: true; id: string }
  | { ok: false; kind: "validation" | "rate_limited" | "forbidden" | "unauthenticated" | "unknown"; message: string };

export async function sendCampaignUseCase(payload: unknown): Promise<SendCampaignResult> {
  const parsed = sendCampaignSchema.safeParse(payload as SendCampaignPayload);
  if (!parsed.success) {
    return { ok: false, kind: "validation", message: parsed.error.issues[0]?.message ?? "Invalid payload" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, kind: "unauthenticated", message: "Sign in required" };

  const { data, error } = await supabase.rpc("fn_send_sms_campaign", { payload: parsed.data });
  if (error) {
    // `RLIM1` is the custom SQLSTATE the RPC raises on a spent budget;
    // `42501` is the permission-guard wrapper's (migration 41).
    if (error.code === "RLIM1") return { ok: false, kind: "rate_limited", message: error.message };
    if (error.code === "42501") return { ok: false, kind: "forbidden", message: error.message };
    // `SMS01` (audience resolved to nobody) and `SMS02` (balance below the
    // campaign's true cost) are both the caller asking for something the data
    // does not support — a 400 with the RPC's own message, not a 500.
    if (error.code === "SMS01" || error.code === "SMS02")
      return { ok: false, kind: "validation", message: error.message };
    return { ok: false, kind: "unknown", message: error.message };
  }
  return { ok: true, id: (data as string) ?? "" };
}
