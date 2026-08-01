"use client";

import { useT } from "@/shared/i18n/useT";
import { DocumentPreview, useLetterhead, useDocSignatures } from "@/shared/documents";
import { useCertificate } from "../logic/hooks";
import { CertificateDocument } from "../documents/CertificateDoc";

/** Opens one testimonial or transfer certificate as a printable A4 sheet. */
export function CertificateViewer({
  kind,
  id,
  onClose,
}: {
  kind: "testimonial" | "transfer";
  id: string;
  onClose: () => void;
}) {
  const { t } = useT();
  const record = useCertificate(kind, id);
  const letterhead = useLetterhead();
  const signatures = useDocSignatures();

  const title = kind === "testimonial" ? t("প্রশংসাপত্র", "Testimonial") : t("স্থানান্তর সনদ", "Transfer Certificate");

  return (
    <DocumentPreview title={title} paper="a4" onClose={onClose}>
      {record.isLoading ? (
        <p className="p-8 text-meta text-text-muted">{t("লোড হচ্ছে…", "Loading…")}</p>
      ) : !record.data ? (
        <p className="p-8 text-meta text-text-muted">{t("সনদ পাওয়া যায়নি।", "Certificate not found.")}</p>
      ) : (
        <CertificateDocument
          record={record.data}
          kind={kind}
          letterhead={letterhead.data}
          signatures={signatures.data}
        />
      )}
    </DocumentPreview>
  );
}
