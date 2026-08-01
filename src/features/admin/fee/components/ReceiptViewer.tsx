"use client";

import { useState } from "react";
import { useT } from "@/shared/i18n/useT";
import { Field, Select } from "@/shared/ui";
import { DocumentPreview, useLetterhead, useDocSignatures } from "@/shared/documents";
import { useReceipt } from "../logic/hooks";
import { ReceiptDocument, type ReceiptFormat } from "../documents/ReceiptDoc";

/**
 * Opens one payment as a printable receipt.
 *
 * Used from the collection form (immediately after taking money) and from the
 * transaction log (reprint), which is the pair A-6.1 asks for — a receipt that
 * exists only at the moment of payment still forces a parallel paper book the
 * first time a parent loses theirs.
 */
export function ReceiptViewer({ paymentId, onClose }: { paymentId: string; onClose: () => void }) {
  const { t, n } = useT();
  const [format, setFormat] = useState<ReceiptFormat>("a5");
  const receipt = useReceipt(paymentId);
  const letterhead = useLetterhead();
  const signatures = useDocSignatures();

  return (
    <DocumentPreview
      title={
        receipt.data?.receipt_no
          ? `${t("রসিদ", "Receipt")} ${n(receipt.data.receipt_no)}`
          : t("রসিদ", "Receipt")
      }
      paper={format}
      onClose={onClose}
      toolbar={
        <Field label={t("কাগজ", "Stock")} className="w-44">
          <Select
            value={format}
            options={[
              { value: "a5", label: t("A5 (দুই কপি)", "A5 (two copies)") },
              { value: "thermal80", label: t("৮০মিমি থার্মাল", "80mm thermal") },
            ]}
            onChange={(e) => setFormat(e.target.value as ReceiptFormat)}
          />
        </Field>
      }
    >
      {receipt.isLoading ? (
        <p className="p-8 text-meta text-text-muted">{t("লোড হচ্ছে…", "Loading…")}</p>
      ) : !receipt.data ? (
        <p className="p-8 text-meta text-text-muted">{t("রসিদ পাওয়া যায়নি।", "Receipt not found.")}</p>
      ) : (
        <ReceiptDocument
          receipt={receipt.data}
          format={format}
          letterhead={letterhead.data}
          signatures={signatures.data}
        />
      )}
    </DocumentPreview>
  );
}
