"use client";

import { useT } from "@/shared/i18n/useT";
import { formatDateTime } from "@/shared/lib/format";
import { Page, Letterhead, SignatureBlock, type LetterheadData, type DocSignature } from "@/shared/documents";
import type { Receipt } from "../logic/receipts";

export type ReceiptFormat = "a5" | "thermal80";

/**
 * Fee receipt (SRA A-6.1 item 1 — "the single highest-impact functional gap in
 * the module").
 *
 * Two stocks, because Bangladeshi school counters run both: an A5 sheet for an
 * office with a laser printer, and an 80 mm thermal roll for a counter with a
 * POS printer. Same data, two layouts; the A5 prints an office copy alongside
 * the parent's, because the school keeps one.
 */
export function ReceiptDocument({
  receipt,
  format,
  letterhead,
  signatures,
}: {
  receipt: Receipt;
  format: ReceiptFormat;
  letterhead: LetterheadData | null | undefined;
  signatures: readonly DocSignature[] | undefined;
}) {
  if (format === "thermal80") {
    return (
      <Page paper="thermal80" className="text-xs">
        <ThermalBody receipt={receipt} letterhead={letterhead} />
      </Page>
    );
  }
  return (
    <Page paper="a5" className="text-meta">
      <div className="flex h-full flex-col gap-3">
        <A5Body receipt={receipt} letterhead={letterhead} signatures={signatures} copy="parent" />
        <div className="border-t border-dashed border-black" />
        <A5Body receipt={receipt} letterhead={letterhead} signatures={signatures} copy="office" />
      </div>
    </Page>
  );
}

function A5Body({
  receipt, letterhead, signatures, copy,
}: {
  receipt: Receipt;
  letterhead: LetterheadData | null | undefined;
  signatures: readonly DocSignature[] | undefined;
  copy: "parent" | "office";
}) {
  const { t, n, isBn } = useT();
  return (
    <section className="flex flex-1 flex-col gap-2">
      <Letterhead data={letterhead} className="pb-1.5" />
      <div className="flex items-baseline justify-between">
        <h2 className="text-meta font-bold tracking-wide">{t("ফি রসিদ", "FEE RECEIPT")}</h2>
        <span className="text-micro">
          {copy === "parent" ? t("অভিভাবক কপি", "Parent copy") : t("অফিস কপি", "Office copy")}
        </span>
      </div>

      <Banner receipt={receipt} />

      <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-micro">
        <Row label={t("রসিদ নং", "Receipt no.")} value={receipt.receipt_no ? n(receipt.receipt_no) : "—"} />
        <Row label={t("তারিখ", "Date")} value={formatDateTime(receipt.paid_at)} />
        <Row label={t("শিক্ষার্থী", "Student")} value={isBn ? receipt.student_bn : receipt.student_en} />
        <Row label={t("আইডি", "ID")} value={receipt.student_code ? n(receipt.student_code) : "—"} />
        <Row label={t("শ্রেণি", "Class")} value={`${(isBn ? receipt.class_bn : receipt.class_en) ?? "—"}${receipt.section ? ` · ${receipt.section}` : ""}`} />
        <Row label={t("রোল", "Roll")} value={receipt.roll != null ? n(receipt.roll) : "—"} />
      </dl>

      <LineTable receipt={receipt} />

      <div className="mt-auto flex items-end justify-between gap-4 pt-2">
        <p className="text-micro">
          {t("মাধ্যম", "Method")}: {receipt.method}
          {receipt.account ? ` · ${receipt.account}` : ""}
          {receipt.txn_ref ? ` · ${receipt.txn_ref}` : ""}
          <br />
          {t("আদায়কারী", "Collected by")}: {receipt.collector}
        </p>
        <SignatureBlock signatures={signatures} roles={["Accountant"]} className="w-40" />
      </div>
    </section>
  );
}

function ThermalBody({ receipt, letterhead }: { receipt: Receipt; letterhead: LetterheadData | null | undefined }) {
  const { t, n, isBn } = useT();
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-center">
        <p className="text-meta font-bold leading-tight">{isBn ? letterhead?.name_bn : letterhead?.name_en}</p>
        {letterhead?.address ? <p className="text-micro leading-tight">{letterhead.address}</p> : null}
        <p className="mt-1 text-micro font-bold">{t("ফি রসিদ", "FEE RECEIPT")}</p>
      </div>
      <Banner receipt={receipt} />
      <div className="border-t border-dashed border-black" />
      <dl className="text-micro leading-snug">
        <Row label={t("রসিদ", "Receipt")} value={receipt.receipt_no ? n(receipt.receipt_no) : "—"} />
        <Row label={t("তারিখ", "Date")} value={formatDateTime(receipt.paid_at)} />
        <Row label={t("শিক্ষার্থী", "Student")} value={isBn ? receipt.student_bn : receipt.student_en} />
        <Row label={t("আইডি", "ID")} value={receipt.student_code ? n(receipt.student_code) : "—"} />
      </dl>
      <div className="border-t border-dashed border-black" />
      {receipt.lines.map((l) => (
        <div key={l.head} className="flex justify-between text-micro">
          <span className="truncate">{l.head}</span>
          <span className="tnum">{n(l.amount)}</span>
        </div>
      ))}
      <div className="border-t border-black" />
      <div className="flex justify-between text-meta font-bold">
        <span>{t("পরিশোধিত", "PAID")}</span>
        <span className="tnum">৳{n(receipt.amount)}</span>
      </div>
      <div className="flex justify-between text-micro">
        <span>{t("বকেয়া", "Balance due")}</span>
        <span className="tnum">৳{n(receipt.invoice_due)}</span>
      </div>
      <div className="border-t border-dashed border-black" />
      <p className="text-center text-micro leading-snug">
        {t("মাধ্যম", "Method")}: {receipt.method} · {receipt.collector}
      </p>
    </div>
  );
}

/** A voided or reversing receipt must SAY SO on the paper. A parent holding a
 *  reprint of a cancelled payment is otherwise holding proof of a payment the
 *  ledger no longer contains. */
function Banner({ receipt }: { receipt: Receipt }) {
  const { t } = useT();
  if (!receipt.voided && !receipt.is_reversal) return null;
  return (
    <p className="border-2 border-black px-2 py-0.5 text-center text-micro font-bold tracking-wide">
      {receipt.is_reversal ? t("ফেরত / বিপরীত এন্ট্রি", "REVERSAL ENTRY") : t("বাতিল রসিদ", "VOIDED RECEIPT")}
      {receipt.void_reason ? ` — ${receipt.void_reason}` : ""}
    </p>
  );
}

function LineTable({ receipt }: { receipt: Receipt }) {
  const { t, n } = useT();
  return (
    <table className="w-full border-collapse text-micro">
      <thead>
        <tr className="border-y border-black">
          <th className="py-0.5 text-left">{t("ফি হেড", "Fee head")}</th>
          <th className="py-0.5 text-right">{t("পরিমাণ", "Amount")}</th>
        </tr>
      </thead>
      <tbody>
        {receipt.lines.length === 0 ? (
          <tr><td className="py-0.5">{receipt.invoice_period ?? "—"}</td><td className="py-0.5 text-right tnum">{n(receipt.invoice_total)}</td></tr>
        ) : (
          receipt.lines.map((l) => (
            <tr key={l.head}>
              <td className="py-0.5">{l.head}</td>
              <td className="py-0.5 text-right tnum">{n(l.amount)}</td>
            </tr>
          ))
        )}
        <tr className="border-t border-black font-bold">
          <td className="py-0.5">{t("এই রসিদে পরিশোধিত", "Paid on this receipt")}</td>
          <td className="py-0.5 text-right tnum">৳{n(receipt.amount)}</td>
        </tr>
        <tr>
          <td className="py-0.5">{t("ইনভয়েস বকেয়া", "Invoice balance due")}</td>
          <td className="py-0.5 text-right tnum">৳{n(receipt.invoice_due)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1.5">
      <dt className="shrink-0 text-neutral-600">{label}:</dt>
      <dd className="min-w-0 flex-1 truncate font-semibold">{value}</dd>
    </div>
  );
}
