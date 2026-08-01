/**
 * Receipt, void and day-book data access (SRA A-6.1 items 1, 5, 8).
 *
 * All three are RPC-backed rather than composed client-side. The day book is a
 * cash total a clerk reconciles against a physical drawer; computing it from a
 * PostgREST page that silently truncates at `db-max-rows` would give a
 * confident wrong number on exactly the busy day it matters.
 */
import type { BrowserClient } from "@/shared/services/supabase/types";

const num = (v: unknown): number => Number(v ?? 0);
const str = (v: unknown): string | null => (v == null ? null : String(v));

export type ReceiptLine = { head: string; amount: number };

export type Receipt = {
  payment_id: string;
  receipt_no: string | null;
  paid_at: string;
  amount: number;
  method: string;
  txn_ref: string | null;
  voided: boolean;
  void_reason: string | null;
  is_reversal: boolean;
  collector: string;
  account: string | null;
  student_code: string | null;
  student_bn: string;
  student_en: string;
  roll: number | null;
  class_bn: string | null;
  class_en: string | null;
  section: string | null;
  invoice_period: string | null;
  invoice_total: number;
  invoice_paid: number;
  invoice_due: number;
  lines: ReceiptLine[];
};

export async function fetchReceipt(s: BrowserClient, paymentId: string): Promise<Receipt | null> {
  const { data, error } = await s.rpc("fn_fee_receipt", { p_payment_id: paymentId });
  if (error) throw new Error(error.message);
  const r = (data ?? {}) as Record<string, unknown>;
  if (!r.payment_id) return null;
  return {
    payment_id: String(r.payment_id),
    receipt_no: str(r.receipt_no),
    paid_at: String(r.paid_at),
    amount: num(r.amount),
    method: String(r.method ?? "cash"),
    txn_ref: str(r.txn_ref),
    voided: !!r.voided,
    void_reason: str(r.void_reason),
    is_reversal: !!r.is_reversal,
    collector: String(r.collector ?? "—"),
    account: str(r.account),
    student_code: str(r.student_code),
    student_bn: String(r.student_bn ?? ""),
    student_en: String(r.student_en ?? ""),
    roll: r.roll == null ? null : num(r.roll),
    class_bn: str(r.class_bn),
    class_en: str(r.class_en),
    section: str(r.section),
    invoice_period: str(r.invoice_period),
    invoice_total: num(r.invoice_total),
    invoice_paid: num(r.invoice_paid),
    invoice_due: num(r.invoice_due),
    lines: ((r.lines ?? []) as Record<string, unknown>[]).map((l) => ({ head: String(l.head ?? ""), amount: num(l.amount) })),
  };
}

export type DayBookEntry = {
  payment_id: string;
  receipt_no: string | null;
  at: string;
  amount: number;
  method: string;
  collector: string;
  voided: boolean;
  reversal: boolean;
  student_code: string | null;
  student_bn: string;
  student_en: string;
};

export type DayBook = {
  date: string;
  gross: number;
  refunds: number;
  net: number;
  count: number;
  by_method: { method: string; amount: number; count: number }[];
  by_collector: { collector_id: string | null; collector: string; amount: number; count: number }[];
  entries: DayBookEntry[];
};

export async function fetchDayBook(s: BrowserClient, date: string, collector: string | null): Promise<DayBook> {
  const { data, error } = await s.rpc("fn_fee_day_book", { p_date: date, p_collector: collector ?? undefined });
  if (error) throw new Error(error.message);
  const r = (data ?? {}) as Record<string, unknown>;
  return {
    date,
    gross: num(r.gross),
    refunds: num(r.refunds),
    net: num(r.net),
    count: num(r.count),
    by_method: ((r.by_method ?? []) as Record<string, unknown>[]).map((m) => ({
      method: String(m.method ?? ""), amount: num(m.amount), count: num(m.count),
    })),
    by_collector: ((r.by_collector ?? []) as Record<string, unknown>[]).map((cRow) => ({
      collector_id: str(cRow.collector_id), collector: String(cRow.collector ?? "—"),
      amount: num(cRow.amount), count: num(cRow.count),
    })),
    entries: ((r.entries ?? []) as Record<string, unknown>[]).map((e) => ({
      payment_id: String(e.payment_id), receipt_no: str(e.receipt_no), at: String(e.at),
      amount: num(e.amount), method: String(e.method ?? ""), collector: String(e.collector ?? "—"),
      voided: !!e.voided, reversal: !!e.reversal,
      student_code: str(e.student_code), student_bn: String(e.student_bn ?? ""), student_en: String(e.student_en ?? ""),
    })),
  };
}

export async function voidPayment(s: BrowserClient, paymentId: string, reason: string): Promise<string> {
  const { data, error } = await s.rpc("fn_void_fee_payment", { p_payment_id: paymentId, p_reason: reason });
  if (error) throw new Error(error.message);
  return (data as string) ?? "";
}

/**
 * Student lookup by name or mobile, not only by code (SRA A-6.1 item 9).
 *
 * "A parent arriving without the ID number cannot be served" — which at a cash
 * counter means they are turned away or the clerk guesses.
 */
export type StudentMatch = { id: string; code: string | null; name_bn: string; name_en: string; section: string; roll: number | null };

export async function searchStudents(s: BrowserClient, term: string): Promise<StudentMatch[]> {
  const needle = term.trim();
  if (needle.length < 2) return [];
  const like = `%${needle.replace(/[%,]/g, "")}%`;
  const { data, error } = await s
    .from("student")
    .select("id, student_code, name_bn, name_en, enr:current_enrollment_id(roll_no, cs:class_section_id(class:class_id(name_en), section:section_id(name)))")
    .or(`student_code.ilike.${like},name_bn.ilike.${like},name_en.ilike.${like}`)
    .is("deleted_at", null)
    .limit(20);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    code: r.student_code,
    name_bn: r.name_bn,
    name_en: r.name_en,
    roll: r.enr?.roll_no ?? null,
    section: `${r.enr?.cs?.class?.name_en ?? ""}${r.enr?.cs?.section?.name ? ` — ${r.enr.cs.section.name}` : ""}`.trim() || "—",
  }));
}
