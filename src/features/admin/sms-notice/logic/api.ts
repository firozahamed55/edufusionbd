// Supabase data access for the SMS & Notice module. RLS-scoped; writes via
// fn_send_sms_campaign / fn_*_sms_template / fn_purchase_sms_package / fn_*_notice.
import type { BrowserClient } from "@/shared/services/supabase/types";

type RpcFn = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const rpcOf = (s: BrowserClient) => s.rpc as unknown as RpcFn;
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
  const { data, error } = await s.from("sms_package").select("id, name, sms_qty, rate, price, masking").eq("is_active", true).order("price");
  if (error) throw error;
  return ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({ id: String(r.id), name: String(r.name), sms_qty: num(r.sms_qty), rate: num(r.rate), price: num(r.price), masking: Boolean(r.masking) }));
}
export async function purchasePackage(s: BrowserClient, id: string): Promise<string> {
  const { data, error } = await rpcOf(s)("fn_purchase_sms_package", { p_package_id: id });
  if (error) throw new Error(error.message);
  return (data as string) ?? "";
}

export type SmsTemplate = { id: string; name: string; description: string | null; body: string; category: string | null; usage_count: number };
export async function fetchTemplates(s: BrowserClient): Promise<SmsTemplate[]> {
  const { data, error } = await s.from("sms_template").select("id, name, description, body, category, usage_count").is("deleted_at", null).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as SmsTemplate[];
}
export async function upsertTemplate(s: BrowserClient, payload: Record<string, unknown>): Promise<string> {
  const { data, error } = await rpcOf(s)("fn_upsert_sms_template", { payload });
  if (error) throw new Error(error.message);
  return (data as string) ?? "";
}
export async function deleteTemplate(s: BrowserClient, id: string): Promise<void> {
  const { error } = await rpcOf(s)("fn_delete_sms_template", { p_id: id });
  if (error) throw new Error(error.message);
}

export type CampaignRow = { id: string; recipient_type: string | null; recipient_group: string | null; body: string | null; recipient_count: number | null; est_cost: number | null; sent_at: string | null };
export async function fetchCampaigns(s: BrowserClient): Promise<CampaignRow[]> {
  const { data, error } = await s.from("sms_campaign").select("id, recipient_type, recipient_group, body, recipient_count, est_cost, sent_at").order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  return (data ?? []) as unknown as CampaignRow[];
}
export async function sendCampaign(s: BrowserClient, payload: Record<string, unknown>): Promise<string> {
  const { data, error } = await rpcOf(s)("fn_send_sms_campaign", { payload });
  if (error) throw new Error(error.message);
  return (data as string) ?? "";
}

export type NoticeRow = { id: string; title: string; body: string | null; audience: string | null; event_date: string | null; status: string };
export async function fetchNotices(s: BrowserClient): Promise<NoticeRow[]> {
  const { data, error } = await s.from("notice").select("id, title, body, audience, event_date, status").eq("is_archived", false).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as NoticeRow[];
}
export async function upsertNotice(s: BrowserClient, payload: Record<string, unknown>): Promise<string> {
  const { data, error } = await rpcOf(s)("fn_upsert_notice", { payload });
  if (error) throw new Error(error.message);
  return (data as string) ?? "";
}
export async function deleteNotice(s: BrowserClient, id: string): Promise<void> {
  const { error } = await rpcOf(s)("fn_delete_notice", { p_id: id });
  if (error) throw new Error(error.message);
}
