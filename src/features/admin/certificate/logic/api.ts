// Supabase data access for the Certificate module. RLS-scoped; record creation
// via fn_create_* RPCs. PDF rendering is deferred (Generate persists the record).
import type { BrowserClient, RpcPayload } from "@/shared/services/supabase/types";
import type { Json } from "@/shared/types/database.types";
import { MAX_OPTIONS } from "@/shared/services/supabase/paging";


/* ---- templates ---- */
export type TemplateRow = { id: string; type: string; is_default: boolean; format_config: Json };
export async function fetchTemplates(s: BrowserClient): Promise<TemplateRow[]> {
  const { data, error } = await s.from("certificate_template").select("id, type, is_default, format_config").order("type").limit(MAX_OPTIONS);
  if (error) throw error;
  return (data ?? []);
}
export async function upsertTemplate(s: BrowserClient, payload: RpcPayload): Promise<string> {
  const { data, error } = await s.rpc("fn_upsert_certificate_template", { payload });
  if (error) throw new Error(error.message);
  return (data as string) ?? "";
}
export async function deleteTemplate(s: BrowserClient, id: string): Promise<void> {
  const { error } = await s.rpc("fn_delete_certificate_template", { p_id: id });
  if (error) throw new Error(error.message);
}

export type ExamOpt = { id: string; name: string };
export async function fetchExamOptions(s: BrowserClient): Promise<ExamOpt[]> {
  const { data, error } = await s.from("exam").select("id, name").order("created_at", { ascending: false }).limit(MAX_OPTIONS);
  if (error) throw error;
  return (data ?? []);
}

/* ---- id-card / admit batches ---- */
export type BatchRow = { id: string; created_at: string; roll_from: number | null; roll_to: number | null; class_name: string; section_name: string | null };
export async function fetchIdCardBatches(s: BrowserClient): Promise<BatchRow[]> {
  const { data, error } = await s.from("id_card_batch")
    .select("id, created_at, roll_from, roll_to, class:class_id(name_en), section:section_id(name)")
    .order("created_at", { ascending: false }).limit(50);
  if (error) throw error;
  return mapBatches(data);
}
export async function fetchAdmitBatches(s: BrowserClient): Promise<BatchRow[]> {
  const { data, error } = await s.from("admit_card_batch")
    .select("id, created_at, roll_from, roll_to, class:class_id(name_en), section:section_id(name)")
    .order("created_at", { ascending: false }).limit(50);
  if (error) throw error;
  return mapBatches(data);
}
/** Shared by the id-card and admit-card batch queries — the two selects are
 *  column-identical, and the compiler now checks each against this shape. */
type BatchRaw = { id: string; created_at: string; roll_from: number | null; roll_to: number | null; class: { name_en: string } | null; section: { name: string } | null };
function mapBatches(data: BatchRaw[] | null): BatchRow[] {
  return (data ?? []).map((r) => ({
    id: r.id, created_at: r.created_at, roll_from: r.roll_from, roll_to: r.roll_to,
    class_name: r.class?.name_en ?? "—", section_name: r.section?.name ?? null,
  }));
}
export async function createIdCardBatch(s: BrowserClient, payload: RpcPayload): Promise<string> {
  const { data, error } = await s.rpc("fn_create_id_card_batch", { payload });
  if (error) throw new Error(error.message);
  return (data as string) ?? "";
}
export async function createAdmitBatch(s: BrowserClient, payload: RpcPayload): Promise<string> {
  const { data, error } = await s.rpc("fn_create_admit_batch", { payload });
  if (error) throw new Error(error.message);
  return (data as string) ?? "";
}

/* ---- testimonial / transfer records ---- */
export type CertRecord = { id: string; created_at: string; cert_no: string | null; session: string | null; name_bn: string; name_en: string };
type CertRaw = { id: string; created_at: string; cert_no: string | null; session: string | null; student: { name_bn: string; name_en: string } | null };
function mapCertRecords(data: CertRaw[] | null): CertRecord[] {
  return (data ?? []).map((r) => ({ id: r.id, created_at: r.created_at, cert_no: r.cert_no, session: r.session, name_bn: r.student?.name_bn ?? "", name_en: r.student?.name_en ?? "" }));
}
export async function fetchTestimonials(s: BrowserClient): Promise<CertRecord[]> {
  const { data, error } = await s.from("testimonial").select("id, created_at, cert_no, session, student:student_id(name_bn, name_en)").order("created_at", { ascending: false }).limit(50);
  if (error) throw error;
  return mapCertRecords(data);
}
export async function fetchTransfers(s: BrowserClient): Promise<CertRecord[]> {
  const { data, error } = await s.from("transfer_certificate").select("id, created_at, cert_no, session, student:student_id(name_bn, name_en)").order("created_at", { ascending: false }).limit(50);
  if (error) throw error;
  return mapCertRecords(data);
}
export async function createTestimonial(s: BrowserClient, payload: RpcPayload): Promise<string> {
  const { data, error } = await s.rpc("fn_create_testimonial", { payload });
  if (error) throw new Error(error.message);
  return (data as string) ?? "";
}
export async function createTransfer(s: BrowserClient, payload: RpcPayload): Promise<string> {
  const { data, error } = await s.rpc("fn_create_transfer", { payload });
  if (error) throw new Error(error.message);
  return (data as string) ?? "";
}

/* ---- generic setting (admit-instruction, exam-essentials) ---- */
export async function fetchSetting(s: BrowserClient, key: string, scope: string): Promise<RpcPayload> {
  const { data, error } = await s.from("setting").select("value").eq("key", key).eq("scope", scope).maybeSingle();
  if (error) throw error;
  return ((data as { value: RpcPayload } | null)?.value ?? {}) as RpcPayload;
}
export async function saveSetting(s: BrowserClient, key: string, scope: string, value: RpcPayload): Promise<void> {
  const { error } = await s.rpc("fn_save_setting", { p_key: key, p_scope: scope, p_value: value });
  if (error) throw new Error(error.message);
}
