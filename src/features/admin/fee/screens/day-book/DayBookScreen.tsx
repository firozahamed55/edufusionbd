"use client";

import { useState } from "react";
import { Wallet, Printer, Ban, Receipt as ReceiptIcon } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { today, formatDateTime } from "@/shared/lib/format";
import {
  PageHeader, Field, Input, Select, Button, Skeleton, ErrorState, StatCard,
  Table, THead, TBody, TR, TH, TD, TableEmpty, Badge, DangerConfirm, useToast,
} from "@/shared/ui";
import { useQueryState } from "@/shared/lib/useQueryState";
import { exportCsv } from "@/shared/lib/exportCsv";
import { useDayBook, useVoidPayment } from "../../logic/hooks";
import type { DayBookEntry } from "../../logic/receipts";
import { ReceiptViewer } from "../../components/ReceiptViewer";
import { useErrorMessage } from "@/shared/services/errors";

/**
 * Day Book / Cash Close (SRA A-6.1 item 8 · portfolio addition #14).
 *
 * "No end-of-day reconciliation per collector, which is the control that makes
 * cash handling auditable." A clerk counts a physical drawer at 4pm; without
 * this screen there is nothing to count it against, so a shortfall is
 * discovered — if ever — at the monthly income statement, by which time nobody
 * can say which day or which counter it came from.
 *
 * Void lives here rather than only on the collection form for the same reason:
 * the mistyped amount is found during the count, not at the moment of payment.
 */
export function DayBookScreen() {
  const { t, n, isBn } = useT();
  const msg = useErrorMessage();
  const toast = useToast();
  // URL-addressable, so "the 3rd of last month, Rahim's counter" is a link a
  // head teacher can be sent (the A-0.1 contract).
  const [q, setQ] = useQueryState({ date: today(), collector: "" });
  const { date, collector } = q;
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [voiding, setVoiding] = useState<DayBookEntry | null>(null);

  const book = useDayBook(date, collector || null);
  const voidPayment = useVoidPayment();
  const data = book.data;

  function exportDay() {
    exportCsv(
      `day-book-${date}`,
      (data?.entries ?? []).map((e) => ({
        receipt_no: e.receipt_no ?? "",
        at: e.at,
        student: e.student_en,
        student_code: e.student_code ?? "",
        method: e.method,
        collector: e.collector,
        amount: e.amount,
        status: e.voided ? "voided" : e.reversal ? "reversal" : "ok",
      })),
      { kind: "fee.day_book", params: { date, collector: collector || null } },
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-6">
      <PageHeader
        crumbs={[{ label: t("ফি ও অর্থ", "Fees & Finance"), href: "/admin/fee/quick-collection-list" }, { label: t("দৈনিক হিসাব", "Day Book") }]}
        title={t("দৈনিক হিসাব ও ক্যাশ ক্লোজ", "Day Book & Cash Close")}
        subtitle={t("দিনের আদায় সংগ্রাহক ও মাধ্যম অনুযায়ী মিলিয়ে দেখুন", "Reconcile the day's collections by collector and method")}
      />

      <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-surface p-5 shadow-e1">
        <Field label={t("তারিখ", "Date")} className="w-48">
          <Input type="date" value={date} max={today()} onChange={(e) => setQ({ date: e.target.value })} />
        </Field>
        <Field label={t("সংগ্রাহক", "Collector")} className="w-60">
          <Select
            value={collector}
            placeholder={t("সকল সংগ্রাহক", "All collectors")}
            options={[
              { value: "", label: t("সকল সংগ্রাহক", "All collectors") },
              ...(data?.by_collector ?? [])
                .filter((cRow) => cRow.collector_id)
                .map((cRow) => ({ value: cRow.collector_id as string, label: cRow.collector })),
            ]}
            onChange={(e) => setQ({ collector: e.target.value })}
          />
        </Field>
        <div className="flex-1" />
        <Button variant="secondary" className="h-10.5" onClick={exportDay} disabled={!data || data.entries.length === 0}>
          {t("CSV এক্সপোর্ট", "Export CSV")}
        </Button>
        <Button variant="primary" className="h-10.5" onClick={() => window.print()} disabled={!data || data.entries.length === 0}>
          <Printer size={16} /> {t("প্রিন্ট", "Print")}
        </Button>
      </div>

      {book.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : book.isError ? (
        <ErrorState title={t("দৈনিক হিসাব লোড করা যায়নি", "Could not load the day book")} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label={t("মোট আদায়", "Gross collected")} value={`৳${n(data?.gross ?? 0)}`} />
            <StatCard label={t("ফেরত / বাতিল", "Refunds / voids")} value={`৳${n(data?.refunds ?? 0)}`} />
            <StatCard label={t("নিট", "Net in drawer")} value={`৳${n(data?.net ?? 0)}`} />
            <StatCard label={t("লেনদেন", "Transactions")} value={n(data?.count ?? 0)} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Breakdown
              title={t("মাধ্যম অনুযায়ী", "By method")}
              rows={(data?.by_method ?? []).map((m) => ({ key: m.method, label: m.method, amount: m.amount, count: m.count }))}
            />
            <Breakdown
              title={t("সংগ্রাহক অনুযায়ী", "By collector")}
              rows={(data?.by_collector ?? []).map((cRow) => ({ key: cRow.collector_id ?? cRow.collector, label: cRow.collector, amount: cRow.amount, count: cRow.count }))}
            />
          </div>

          <div data-print="sheet" className="overflow-hidden rounded-2xl border border-border-default bg-surface shadow-e1">
            <div className="border-b border-border-default px-5 py-4">
              <p className="text-base font-semibold text-text-primary">{t("লেনদেন", "Transactions")}</p>
            </div>
            <Table>
              <THead>
                <TR>
                  <TH>{t("রসিদ", "Receipt")}</TH>
                  <TH>{t("সময়", "Time")}</TH>
                  <TH>{t("শিক্ষার্থী", "Student")}</TH>
                  <TH>{t("মাধ্যম", "Method")}</TH>
                  <TH>{t("সংগ্রাহক", "Collector")}</TH>
                  <TH className="text-right">{t("পরিমাণ", "Amount")}</TH>
                  <TH className="text-right">{t("কাজ", "Actions")}</TH>
                </TR>
              </THead>
              <TBody>
                {(data?.entries.length ?? 0) === 0 ? (
                  <TableEmpty colSpan={7} icon={<Wallet size={22} />} title={t("এই দিনে কোনো আদায় নেই", "No collections on this day")} />
                ) : (
                  (data?.entries ?? []).map((e) => (
                    <TR key={e.payment_id}>
                      <TD className="font-latin tnum">{e.receipt_no ? n(e.receipt_no) : "—"}</TD>
                      <TD className="tnum">{formatDateTime(e.at)}</TD>
                      <TD>
                        <span className="block">{isBn ? e.student_bn : e.student_en}</span>
                        <span className="block text-micro text-text-muted">{e.student_code ? n(e.student_code) : "—"}</span>
                      </TD>
                      <TD>{e.method}</TD>
                      <TD>{e.collector}</TD>
                      <TD className={cn("text-right tnum", e.amount < 0 && "text-danger-fg")}>৳{n(e.amount)}</TD>
                      <TD>
                        <div className="flex items-center justify-end gap-2" data-print="hide">
                          {e.voided ? <Badge tone="danger" dot>{t("বাতিল", "Voided")}</Badge> : null}
                          {e.reversal ? <Badge tone="warning" dot>{t("বিপরীত", "Reversal")}</Badge> : null}
                          <Button variant="ghost" onClick={() => setReceiptId(e.payment_id)}>
                            <ReceiptIcon size={15} /> {t("রসিদ", "Receipt")}
                          </Button>
                          {!e.voided && !e.reversal ? (
                            <Button variant="ghost" onClick={() => setVoiding(e)}>
                              <Ban size={15} /> {t("বাতিল", "Void")}
                            </Button>
                          ) : null}
                        </div>
                      </TD>
                    </TR>
                  ))
                )}
              </TBody>
            </Table>
          </div>
        </>
      )}

      {receiptId ? <ReceiptViewer paymentId={receiptId} onClose={() => setReceiptId(null)} /> : null}

      {voiding ? (
        <DangerConfirm
          open
          onClose={() => setVoiding(null)}
          title={t("পেমেন্ট বাতিল করুন", "Void this payment")}
          description={t(
            "পেমেন্টটি মুছে যাবে না — একটি বিপরীত এন্ট্রি লেখা হবে, দুটোই হিসাবে থাকবে। অভিভাবকের হাতে থাকা রসিদটি অকার্যকর হবে।",
            "The payment is not deleted — a reversing entry is written and both stay in the ledger. The receipt the parent is holding becomes void.",
          )}
          count={Math.round(voiding.amount)}
          preview={`${isBn ? voiding.student_bn : voiding.student_en} · ${voiding.receipt_no ?? "—"}`}
          confirmLabel={t("পেমেন্ট বাতিল করুন", "Void payment")}
          cancelLabel={t("ফিরে যান", "Go back")}
          typeToConfirmLabel={(phrase) => t(`নিশ্চিত করতে ${n(phrase)} টাইপ করুন`, `Type ${phrase} to confirm`)}
          reasonLabel={t("বাতিলের কারণ", "Reason for voiding")}
          loading={voidPayment.isPending}
          onConfirm={(reason) => {
            voidPayment.mutate(
              { paymentId: voiding.payment_id, reason: reason ?? "" },
              {
                onSuccess: (reversalId) => {
                  toast({ title: t("পেমেন্ট বাতিল হয়েছে", "Payment voided"), variant: "success" });
                  setVoiding(null);
                  // The reversing entry is itself a receipt, and the counter
                  // needs it on paper to reconcile the drawer.
                  if (reversalId) setReceiptId(reversalId);
                },
                onError: (e: unknown) => toast({ title: msg(e, { bn: "বাতিল ব্যর্থ", en: "Void failed" }), variant: "error" }),
              },
            );
          }}
        />
      ) : null}
    </div>
  );
}

function Breakdown({
  title,
  rows,
}: {
  title: string;
  rows: { key: string; label: string; amount: number; count: number }[];
}) {
  const { t, n } = useT();
  return (
    <div className="overflow-hidden rounded-2xl border border-border-default bg-surface shadow-e1">
      <div className="border-b border-border-default px-5 py-3">
        <p className="text-meta font-semibold text-text-primary">{title}</p>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-4 text-meta text-text-muted">{t("কোনো তথ্য নেই", "Nothing to show")}</p>
      ) : (
        <Table>
          <TBody>
            {rows.map((r) => (
              <TR key={r.key}>
                <TD>{r.label}</TD>
                <TD className="text-right tnum text-text-muted">{n(r.count)}</TD>
                <TD className="text-right tnum font-semibold">৳{n(r.amount)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
