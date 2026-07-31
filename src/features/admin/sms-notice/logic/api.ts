// Supabase data access for the SMS & Notice module. RLS-scoped; writes via
// fn_send_sms_campaign / fn_*_sms_template / fn_purchase_sms_package / fn_*_notice.
import { z } from "zod";
import type { BrowserClient, RpcPayload } from "@/shared/services/supabase/types";
import { optionalText, optionalUuid } from "@/shared/lib/validation";
import { MAX_OPTIONS, PAGE_SIZE, pageRange, type Paged } from "@/shared/services/supabase/paging";

const num = (v: unknown) => Number(v ?? 0);

export type SmsAccount = { balance: number; per_sms_rate: number; masking_enabled: boolean; last_recharge_amount: number | null; last_recharge_at: string | null };
export async function fetchSmsAccount(s: BrowserClient): Promise<SmsAccount | null> {
  const { data, error } = await s.from("sms_account").select("balance, per_sms_rate, masking_enabled, last_recharge_amount, last_recharge_at").limit(1).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const r = data as Record<string, unknown>;
  return { balance: num(r.balance), per_sms_rate: num(r.per_sms_rate), masking_enabled: Boolean(r.masking_enabled), last_recharge_amount: r.last_recharge_amount == null ? null : num(r.last_recharge_amount), last_recharge_at: (r.last_recharge_at as string) ?? null };
}

export type SmsPackage = { id: string; name: string; sms_qty: number; rate: number; price: number; masking: boolean };
export async function fetchPackages(s: BrowserClient): Promise<SmsPackage[]> {
  const { data, error } = await s.from("sms_package").select("id, name, sms_qty, rate, price, masking").eq("is_active", true).order("price").limit(MAX_OPTIONS);
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: String(r.id), name: String(r.name), sms_qty: num(r.sms_qty), rate: num(r.rate), price: num(r.price), masking: Boolean(r.masking) }));
}
export async function purchasePackage(s: BrowserClient, id: string): Promise<string> {
  const { data, error } = await s.rpc("fn_purchase_sms_package", { p_package_id: id });
  if (error) throw new Error(error.message);
  return (data as string) ?? "";
}

export type SmsTemplate = { id: string; name: string; description: string | null; body: string; category: string | null; usage_count: number };
export async function fetchTemplates(s: BrowserClient): Promise<SmsTemplate[]> {
  const { data, error } = await s.from("sms_template").select("id, name, description, body, category, usage_count").is("deleted_at", null).order("created_at", { ascending: false }).limit(MAX_OPTIONS);
  if (error) throw error;
  return (data ?? []);
}
export async function upsertTemplate(s: BrowserClient, payload: RpcPayload): Promise<string> {
  const { data, error } = await s.rpc("fn_upsert_sms_template", { payload });
  if (error) throw new Error(error.message);
  return (data as string) ?? "";
}
export async function deleteTemplate(s: BrowserClient, id: string): Promise<void> {
  const { error } = await s.rpc("fn_delete_sms_template", { p_id: id });
  if (error) throw new Error(error.message);
}

export type CampaignRow = { id: string; recipient_type: string | null; recipient_group: string | null; body: string | null; recipient_count: number | null; est_cost: number | null; sent_at: string | null };
/**
 * Campaign history grows for the life of the tenant and is never pruned, so it
 * is server-paged rather than capped: a cap would make old campaigns silently
 * unreachable, which is the same class of bug as the truncation above.
 */
export async function fetchCampaigns(s: BrowserClient, page = 1, size = PAGE_SIZE): Promise<Paged<CampaignRow>> {
  const [from, to] = pageRange(page, size);
  const { data, error, count } = await s
    .from("sms_campaign")
    .select("id, recipient_type, recipient_group, body, recipient_count, est_cost, sent_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0 };
}
/**
 * Who a campaign will actually reach, resolved from the roster (SRA F-2a).
 *
 * The Send screen used to ask the operator to TYPE the recipient count, and
 * that typed number was what the balance was debited by. The system holds the
 * roster — it knows how many guardians are in section 9-A — so this replaces a
 * guess with the answer. The same function backs `fn_send_sms_campaign`'s own
 * billing, which is what makes the previewed number and the charged number the
 * same number rather than two numbers that agree by convention.
 */
export type ResolvedRecipients = {
  count: number;
  /** Bounded preview so the operator can check WHO, not just how many. */
  sample: { name: string; mobile: string }[];
};
export async function resolveRecipients(
  s: BrowserClient,
  audience: string,
  classSectionId?: string | null,
): Promise<ResolvedRecipients> {
  const { data, error } = await s.rpc("fn_resolve_sms_recipients", {
    p_audience: audience,
    p_class_section_id: classSectionId || undefined,
  });
  if (error) throw new Error(error.message);
  const r = (data ?? {}) as Partial<ResolvedRecipients>;
  return { count: num(r.count), sample: r.sample ?? [] };
}

/**
 * SMS send.
 *
 * `recipient_count` is deliberately ABSENT from this schema. It used to be the
 * field that spent money — the RPC debited `balance - recipient_count` straight
 * from the payload, with no cross-check against an actual recipient list, so a
 * typo was a billing error in either direction and a negative one would have
 * *credited* the account. It is now computed server-side from the resolved
 * roster and returned, not accepted. A client cannot influence what it is
 * charged, which is the only durable form of this fix.
 *
 * `class_section_id` replaces the free-text `recipient_group` as the thing that
 * actually selects recipients; the text field survives only as a human label on
 * the campaign record.
 *
 * `body.max(1000)` mirrors the practical SMS ceiling — a longer body is silently
 * truncated by every gateway, after being paid for in full.
 */
export const sendCampaignSchema = z
  .object({
    recipient_type: z.string().min(1),
    recipient_group: optionalText(120),
    class_section_id: optionalUuid,
    language: z.enum(["bn", "en"]),
    template_id: optionalUuid,
    body: z.string().trim().min(1, "Message body is required").max(1000),
  })
  .strict();

export type SendCampaignPayload = {
  recipient_type: string;
  recipient_group?: string;
  class_section_id?: string;
  language: string;
  template_id?: string;
  body: string;
};

/**
 * Routed through `POST /api/v1/sms/send`, not `supabase.rpc()` directly — see
 * `src/server/sms/sendCampaign.ts` for why this is the one write that goes
 * through the server tier. `s` (the `BrowserClient`) is unused here; kept in
 * the signature so this function matches every other mutation in the module
 * and callers do not need to know which few writes are routed differently.
 */
export async function sendCampaign(
  _s: BrowserClient,
  payload: SendCampaignPayload,
): Promise<string> {
  const res = await fetch("/api/v1/sms/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(sendCampaignSchema.parse(payload)),
  });
  const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok) throw new Error(body.message ?? `Send failed (${res.status})`);
  return body.id ?? "";
}

export type NoticeRow = { id: string; title: string; body: string | null; audience: string | null; event_date: string | null; status: string };
export type CampaignTotals = { campaigns: number; recipients: number; cost: number };
/**
 * Totals for the history tiles.
 *
 * Computed in the database, NOT by summing the rows on screen. Summing the
 * fetched page is the exact bug `fee/logic/api.ts` documents: the number looks
 * authoritative and silently describes a subset. Same reason
 * `fn_digital_transaction_stats` exists.
 */
export async function fetchCampaignTotals(s: BrowserClient): Promise<CampaignTotals> {
  const { data, error } = await s.rpc("fn_sms_campaign_totals");
  if (error) throw new Error(error.message);
  const r = (data ?? {}) as Partial<CampaignTotals>;
  return { campaigns: num(r.campaigns), recipients: num(r.recipients), cost: num(r.cost) };
}

/** Same reasoning as `fetchCampaigns` — the notice board only ever grows. */
export async function fetchNotices(
  s: BrowserClient,
  { page = 1, q = "", status = "" }: { page?: number; q?: string; status?: string } = {},
): Promise<Paged<NoticeRow>> {
  const [from, to] = pageRange(page);
  // Server-side, because the board only ever grows: filtering the fetched page
  // would search the newest 20 notices and report the rest as absent.
  let query = s
    .from("notice")
    .select("id, title, body, audience, event_date, status", { count: "exact" })
    .eq("is_archived", false)
    .order("created_at", { ascending: false });

  const needle = q.trim().replace(/[%,]/g, "");
  if (needle) query = query.or(`title.ilike.%${needle}%,body.ilike.%${needle}%`);
  if (status) query = query.eq("status", status);

  const { data, error, count } = await query.range(from, to);
  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0 };
}
export async function upsertNotice(s: BrowserClient, payload: RpcPayload): Promise<string> {
  const { data, error } = await s.rpc("fn_upsert_notice", { payload });
  if (error) throw new Error(error.message);
  return (data as string) ?? "";
}
export async function deleteNotice(s: BrowserClient, id: string): Promise<void> {
  const { error } = await s.rpc("fn_delete_notice", { p_id: id });
  if (error) throw new Error(error.message);
}
