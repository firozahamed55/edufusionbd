// Supabase data access for the Fee module. RLS-scoped; writes go through the
// transaction-safe fn_collect_fee / fn_*_fee_mapping / fn_delete_fee_invoice RPCs.
import { z } from "zod";
import type { BrowserClient } from "@/shared/services/supabase/types";
import { amountString, paymentMethod, shortText, uuid } from "@/shared/lib/validation";

type RpcFn = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const num = (v: unknown): number => Number(v ?? 0);

/* ------------------------------------------------------------- reference data */

export type FeeHeadRow = { id: string; name: string; category: string };
export async function fetchFeeHeads(supabase: BrowserClient): Promise<FeeHeadRow[]> {
  const { data, error } = await supabase.from("fee_head").select("id, name, category").is("deleted_at", null).order("name");
  if (error) throw error;
  return (data ?? []) as unknown as FeeHeadRow[];
}

export type AccountRow = { id: string; name: string; type: string };
export async function fetchAccounts(supabase: BrowserClient): Promise<AccountRow[]> {
  const { data, error } = await supabase.from("financial_account").select("id, name, type").eq("is_active", true).order("name");
  if (error) throw error;
  return (data ?? []) as unknown as AccountRow[];
}

/* ------------------------------------------------------------------ mappings */

export type FeeMappingRow = {
  id: string; class_bn: string; class_en: string; level: number;
  head: string; category: string | null; amount: number; frequency: string; is_active: boolean;
};
export async function fetchFeeMappings(supabase: BrowserClient): Promise<FeeMappingRow[]> {
  const { data, error } = await supabase
    .from("fee_mapping")
    .select("id, amount, frequency, is_active, class:class_id(name_bn, name_en, numeric_level), head:fee_head_id(name), category:student_category_id(name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  type Raw = {
    id: string; amount: number | string; frequency: string; is_active: boolean;
    class: { name_bn: string; name_en: string; numeric_level: number | null } | null;
    head: { name: string } | null; category: { name: string } | null;
  };
  return ((data ?? []) as unknown as Raw[]).map((r) => ({
    id: r.id, class_bn: r.class?.name_bn ?? "", class_en: r.class?.name_en ?? "", level: r.class?.numeric_level ?? 0,
    head: r.head?.name ?? "", category: r.category?.name ?? null, amount: num(r.amount), frequency: r.frequency, is_active: r.is_active,
  }));
}

/** Same amount trap as `collectPayloadSchema` — this one sets the amount every
 *  future invoice inherits, so a bad cast here is wrong for a whole class. */
export const feeMappingSchema = z
  .object({
    id: uuid.optional(),
    class_id: uuid,
    fee_head_id: uuid,
    student_category_id: uuid.optional(),
    amount: amountString,
    frequency: z.string().min(1),
    is_active: z.boolean(),
  })
  .strict();

export type FeeMappingPayload = z.input<typeof feeMappingSchema>;

export async function upsertFeeMapping(supabase: BrowserClient, payload: FeeMappingPayload): Promise<string> {
  const rpc: RpcFn = (fn, args) => (supabase as unknown as { rpc: RpcFn }).rpc(fn, args);
  const { data, error } = await rpc("fn_upsert_fee_mapping", { payload: feeMappingSchema.parse(payload) });
  if (error) throw new Error(error.message);
  return (data as string) ?? "";
}
export async function deleteFeeMapping(supabase: BrowserClient, id: string): Promise<void> {
  const rpc: RpcFn = (fn, args) => (supabase as unknown as { rpc: RpcFn }).rpc(fn, args);
  const { error } = await rpc("fn_delete_fee_mapping", { p_id: id });
  if (error) throw new Error(error.message);
}

/* ------------------------------------------------------------------ invoices */

export type StudentInvoice = {
  id: string; period: string | null; total: number; paid: number; waiver: number; due: number; status: string;
  heads: string;
};
export async function fetchStudentInvoices(supabase: BrowserClient, studentId: string): Promise<StudentInvoice[]> {
  const { data, error } = await supabase
    .from("fee_invoice")
    .select("id, period, total_amount, paid_amount, waiver_amount, due_amount, status, lines:fee_invoice_line(amount, head:fee_head_id(name))")
    .eq("student_id", studentId).is("deleted_at", null).order("created_at", { ascending: false });
  if (error) throw error;
  type Raw = {
    id: string; period: string | null; total_amount: number; paid_amount: number; waiver_amount: number; due_amount: number; status: string;
    lines: { amount: number; head: { name: string } | null }[] | null;
  };
  return ((data ?? []) as unknown as Raw[]).map((r) => ({
    id: r.id, period: r.period, total: num(r.total_amount), paid: num(r.paid_amount), waiver: num(r.waiver_amount), due: num(r.due_amount), status: r.status,
    heads: (r.lines ?? []).map((l) => l.head?.name).filter(Boolean).join(", "),
  }));
}

export type UnpaidStudent = { studentId: string; code: string | null; roll: number | null; name_bn: string; name_en: string; detail: string; due: number };

/**
 * Unpaid students in ONE section.
 *
 * This used to select every unpaid invoice in the institution and then filter by
 * section in JS. That was not merely slow — it was WRONG at scale: PostgREST caps
 * a response at `db-max-rows`, so once the institution had more unpaid invoices
 * than the cap, students in the requested section could fall outside the returned
 * page and the screen would report them as having nothing due. A fee-collection
 * screen that under-reports debt is a silent revenue leak.
 *
 * The filter is now pushed into the query with `!inner` joins, so Postgres does
 * the selection and the transfer is bounded by the section's size.
 */
export async function fetchUnpaidBySection(supabase: BrowserClient, classSectionId: string): Promise<UnpaidStudent[]> {
  const { data, error } = await supabase
    .from("fee_invoice")
    .select("id, period, due_amount, student:student_id!inner(id, student_code, name_bn, name_en, enr:current_enrollment_id!inner(class_section_id, roll_no)), lines:fee_invoice_line(amount, head:fee_head_id(name))")
    .eq("student.enr.class_section_id", classSectionId)
    .gt("due_amount", 0).is("deleted_at", null);
  if (error) throw error;
  type Raw = {
    id: string; period: string | null; due_amount: number;
    student: { id: string; student_code: string | null; name_bn: string; name_en: string; enr: { class_section_id: string; roll_no: number | null } | null } | null;
    lines: { amount: number; head: { name: string } | null }[] | null;
  };
  const rows = (data ?? []) as unknown as Raw[];
  const byStudent = new Map<string, UnpaidStudent>();
  for (const r of rows) {
    const sid = r.student?.id ?? "";
    if (!sid) continue;
    const detail = (r.lines ?? []).map((l) => `${l.head?.name ?? ""}(${num(l.amount)})`).join(", ");
    const existing = byStudent.get(sid);
    if (existing) {
      existing.due += num(r.due_amount);
      existing.detail = [existing.detail, detail].filter(Boolean).join(" • ");
    } else {
      byStudent.set(sid, {
        studentId: sid, code: r.student?.student_code ?? null, roll: r.student?.enr?.roll_no ?? null,
        name_bn: r.student?.name_bn ?? "", name_en: r.student?.name_en ?? "", detail, due: num(r.due_amount),
      });
    }
  }
  return [...byStudent.values()].sort((a, b) => (a.roll ?? 0) - (b.roll ?? 0));
}

export type AppliedFee = { id: string; period: string | null; due: number; status: string; code: string | null; name_bn: string; name_en: string; heads: string };

export const APPLIED_FEE_PAGE_SIZE = 25;

/**
 * Every invoice in the institution, newest first — the Delete Fees screen.
 *
 * Paginated because `fee_invoice` grows as students × fee heads × periods: one
 * 800-student school generates thousands of rows per year, and this screen exists
 * to find ONE mistaken invoice among them. Matches `fetchDigitalTransactions`'
 * `{ rows, total }` shape so both feed the same `Pagination` footer.
 */
export async function fetchAppliedFees(
  supabase: BrowserClient,
  { page = 1, perPage = APPLIED_FEE_PAGE_SIZE }: { page?: number; perPage?: number } = {},
): Promise<{ rows: AppliedFee[]; total: number }> {
  const from = (page - 1) * perPage;
  const { data, error, count } = await supabase
    .from("fee_invoice")
    .select(
      "id, period, due_amount, status, student:student_id(student_code, name_bn, name_en), lines:fee_invoice_line(head:fee_head_id(name))",
      { count: "exact" },
    )
    .is("deleted_at", null).order("created_at", { ascending: false })
    .range(from, from + perPage - 1);
  if (error) throw error;
  type Raw = {
    id: string; period: string | null; due_amount: number; status: string;
    student: { student_code: string | null; name_bn: string; name_en: string } | null;
    lines: { head: { name: string } | null }[] | null;
  };
  const rows = ((data ?? []) as unknown as Raw[]).map((r) => ({
    id: r.id, period: r.period, due: num(r.due_amount), status: r.status,
    code: r.student?.student_code ?? null, name_bn: r.student?.name_bn ?? "", name_en: r.student?.name_en ?? "",
    heads: (r.lines ?? []).map((l) => l.head?.name).filter(Boolean).join(", "),
  }));
  return { rows, total: count ?? 0 };
}

export type StudentProfile = { id: string; code: string | null; name_bn: string; name_en: string; roll: number | null; section: string; father: string | null; mobile: string | null; category: string | null };
export async function fetchStudentProfile(supabase: BrowserClient, studentId: string): Promise<StudentProfile | null> {
  const { data, error } = await supabase
    .from("student")
    .select("id, student_code, name_bn, name_en, category:student_category_id(name), enr:current_enrollment_id(roll_no, cs:class_section_id(class:class_id(name_bn, name_en), section:section_id(name))), student_guardian(is_primary_contact, relationship, guardian:guardian_id(name, mobile))")
    .eq("id", studentId).is("deleted_at", null).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const t = data as unknown as Record<string, unknown>;
  const enr = t.enr as { roll_no: number | null; cs: { class: { name_bn: string; name_en: string } | null; section: { name: string } | null } | null } | null;
  const sgs = (t.student_guardian ?? []) as { is_primary_contact: boolean; relationship: string; guardian: { name: string | null; mobile: string | null } | null }[];
  const primary = sgs.find((g) => g.is_primary_contact) ?? sgs.find((g) => g.relationship === "father") ?? sgs[0];
  const cls = enr?.cs?.class;
  return {
    id: String(t.id), code: (t.student_code as string) ?? null, name_bn: String(t.name_bn ?? ""), name_en: String(t.name_en ?? ""),
    roll: enr?.roll_no ?? null,
    section: `${cls?.name_en ?? ""}${enr?.cs?.section?.name ? " — " + enr.cs.section.name : ""}`.trim() || "—",
    father: primary?.guardian?.name ?? null, mobile: primary?.guardian?.mobile ?? null,
    category: (t.category as { name: string } | null)?.name ?? null,
  };
}

export async function findStudentIdByCode(supabase: BrowserClient, code: string): Promise<string | null> {
  const { data, error } = await supabase.from("student").select("id").eq("student_code", code).is("deleted_at", null).maybeSingle();
  if (error) throw error;
  return (data as { id: string } | null)?.id ?? null;
}

/**
 * The money boundary. Every field here reaches `fn_collect_fee` as jsonb and is
 * cast in SQL, so a shape error becomes a Postgres cast failure mid-transaction
 * rather than a form error. `.strict()` matters as much as the field rules: it
 * catches a renamed key (`invoice_id` for `fee_invoice_id`) which would otherwise
 * be silently dropped by `payload->>` and post a payment against nothing.
 */
export const collectPayloadSchema = z
  .object({
    fee_invoice_id: uuid,
    amount: amountString,
    method: paymentMethod,
    account_id: uuid.optional(),
    txn_ref: shortText(64).optional(),
    paid_by: shortText(120).optional(),
    paid_at: z.string().optional(),
  })
  .strict();

export type CollectPayload = z.input<typeof collectPayloadSchema>;

export async function collectFee(supabase: BrowserClient, payload: CollectPayload): Promise<string> {
  const rpc: RpcFn = (fn, args) => (supabase as unknown as { rpc: RpcFn }).rpc(fn, args);
  const { data, error } = await rpc("fn_collect_fee", { payload: collectPayloadSchema.parse(payload) });
  if (error) throw new Error(error.message);
  return (data as string) ?? "";
}

/**
 * Bulk void. `min(1)` is the one that earns its keep: `fn_delete_fee_invoice`
 * loops the array, so an empty list is a no-op that reports success — the screen
 * would show "3 invoices deleted" having deleted nothing.
 */
const deleteInvoiceIdsSchema = z.array(uuid).min(1).max(500);

export async function deleteFeeInvoices(supabase: BrowserClient, ids: string[]): Promise<number> {
  const rpc: RpcFn = (fn, args) => (supabase as unknown as { rpc: RpcFn }).rpc(fn, args);
  const { data, error } = await rpc("fn_delete_fee_invoice", {
    payload: { ids: deleteInvoiceIdsSchema.parse(ids) },
  });
  if (error) throw new Error(error.message);
  return (data as number) ?? 0;
}

/* --------------------------------------------------------------- digital + reports */

export type DigitalTxn = { id: string; at: string; amount: number; gateway: string; gateway_txn_id: string | null; status: string; name_bn: string; name_en: string; code: string | null };

const DIGITAL_TXN_PAGE_SIZE = 25;

export async function fetchDigitalTransactions(
  supabase: BrowserClient,
  { page = 1, perPage = DIGITAL_TXN_PAGE_SIZE }: { page?: number; perPage?: number } = {},
): Promise<{ rows: DigitalTxn[]; total: number }> {
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  const { data, error, count } = await supabase
    .from("digital_transaction")
    .select("id, at, amount, gateway, gateway_txn_id, status, student:student_id(student_code, name_bn, name_en)", { count: "exact" })
    .order("at", { ascending: false })
    .range(from, to);
  if (error) throw error;
  type Raw = { id: string; at: string; amount: number; gateway: string; gateway_txn_id: string | null; status: string; student: { student_code: string | null; name_bn: string; name_en: string } | null };
  const rows = ((data ?? []) as unknown as Raw[]).map((r) => ({
    id: r.id, at: r.at, amount: num(r.amount), gateway: r.gateway, gateway_txn_id: r.gateway_txn_id, status: r.status,
    name_bn: r.student?.name_bn ?? "", name_en: r.student?.name_en ?? "", code: r.student?.student_code ?? null,
  }));
  return { rows, total: count ?? 0 };
}

export type DigitalTxnStats = { total: number; successCount: number; successTotal: number; pendingCount: number };

/**
 * Institution-wide KPI totals, aggregated in Postgres.
 *
 * Previously this selected `status, amount` for EVERY transaction and reduced in
 * JS. Beyond the unbounded transfer, it was quietly incorrect: PostgREST truncates
 * at `db-max-rows`, so past that point the tiles showed a total for a partial
 * table with no indication anything was missing — the worst failure mode a
 * financial summary has. `fn_digital_transaction_stats` computes it in one round
 * trip over rows that never leave the database.
 */
export async function fetchDigitalTransactionStats(supabase: BrowserClient): Promise<DigitalTxnStats> {
  const rpc: RpcFn = (fn, args) => (supabase as unknown as { rpc: RpcFn }).rpc(fn, args);
  const { data, error } = await rpc("fn_digital_transaction_stats", {});
  if (error) throw new Error(error.message);
  const r = (data ?? {}) as Partial<DigitalTxnStats>;
  return {
    total: num(r.total),
    successCount: num(r.successCount),
    successTotal: num(r.successTotal),
    pendingCount: num(r.pendingCount),
  };
}

export type UnpaidInstitute = {
  rows: { numeric_level: number; cls_bn: string; cls_en: string; sec_name: string | null; total_students: number; due_students: number; due_amount: number }[];
  total_students: number; due_students: number; total_due: number;
};
export async function fetchUnpaidByInstitute(supabase: BrowserClient): Promise<UnpaidInstitute> {
  const rpc: RpcFn = (fn, args) => (supabase as unknown as { rpc: RpcFn }).rpc(fn, args);
  const { data, error } = await rpc("fn_unpaid_by_institute", {});
  if (error) throw new Error(error.message);
  return data as UnpaidInstitute;
}

export type IncomeStatement = {
  income: { head: string; amount: number }[]; total_income: number;
  expense: { head: string; amount: number }[]; total_expense: number;
};
export async function fetchIncomeStatement(supabase: BrowserClient, from: string, to: string): Promise<IncomeStatement> {
  const rpc: RpcFn = (fn, args) => (supabase as unknown as { rpc: RpcFn }).rpc(fn, args);
  const { data, error } = await rpc("fn_fee_income_statement", { p_from: from, p_to: to });
  if (error) throw new Error(error.message);
  return data as IncomeStatement;
}
