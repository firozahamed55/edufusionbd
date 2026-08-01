"use client";

import { useT } from "@/shared/i18n/useT";
import { formatDate } from "@/shared/lib/format";
import {
  Page, Qr, Letterhead, SignatureBlock, fallbackSerial, verificationUrl,
  type LetterheadData, type DocSignature,
} from "@/shared/documents";
import type { CertificateRecord } from "../logic/certificates";

/**
 * Testimonial and Transfer Certificate (SRA A-7 — the module created *records
 * of documents* and produced no document).
 *
 * These are legal-adjacent: a receiving school accepts a transfer certificate
 * as evidence a student left in good standing. So the sheet carries a serial,
 * a QR resolving to a public verification page, and a signature block that
 * prints a ruled line when the institution has not uploaded a signature —
 * rather than a hole where an authorisation should be.
 */
export function CertificateDocument({
  record,
  kind,
  letterhead,
  signatures,
}: {
  record: CertificateRecord;
  kind: "testimonial" | "transfer";
  letterhead: LetterheadData | null | undefined;
  signatures: readonly DocSignature[] | undefined;
}) {
  const { t, n, isBn } = useT();
  const isT = kind === "testimonial";
  const serial = record.cert_no ?? fallbackSerial(record.id);
  const name = isBn ? record.name_bn : record.name_en;
  const issued = record.issued_at ?? record.created_at;

  return (
    <Page paper="a4" className="text-meta leading-relaxed">
      <div className="flex h-full flex-col gap-5">
        <Letterhead data={letterhead} />

        <div className="flex items-baseline justify-between text-micro">
          <span>
            {t("সনদ নং", "Serial no.")}: <strong className="font-latin">{n(serial)}</strong>
          </span>
          <span>
            {t("তারিখ", "Date")}: <strong>{formatDate(issued)}</strong>
          </span>
        </div>

        <h2 className="self-center border-b-2 border-black px-6 pb-1 text-label font-bold tracking-wide">
          {isT ? t("প্রশংসাপত্র", "TESTIMONIAL") : t("প্রত্যয়ন / স্থানান্তর সনদ", "TRANSFER CERTIFICATE")}
        </h2>

        <div className="flex flex-col gap-3 text-justify">
          {isT ? (
            <p>
              {t(
                `এই মর্মে প্রত্যয়ন করা যাইতেছে যে, ${name}${record.parent_name ? `, পিতা/মাতা: ${record.parent_name}` : ""}, ` +
                  `${record.session ? `${n(record.session)} শিক্ষাবর্ষে ` : ""}এই প্রতিষ্ঠানের একজন নিয়মিত শিক্ষার্থী ছিল। ` +
                  `আমার জানামতে তাহার আচার-আচরণ ${record.conduct || "সন্তোষজনক"} ছিল। আমি তাহার সর্বাঙ্গীণ সাফল্য কামনা করি।`,
                `This is to certify that ${name}${record.parent_name ? `, child of ${record.parent_name}` : ""}, ` +
                  `was a regular student of this institution${record.session ? ` during the ${record.session} session` : ""}. ` +
                  `To the best of my knowledge his/her conduct was ${record.conduct || "satisfactory"}. ` +
                  `I wish him/her every success.`,
              )}
            </p>
          ) : (
            <p>
              {t(
                `এই মর্মে প্রত্যয়ন করা যাইতেছে যে, ${name}${record.parent_name ? `, পিতা/মাতা: ${record.parent_name}` : ""}, ` +
                  `${record.session ? `${n(record.session)} শিক্ষাবর্ষ পর্যন্ত ` : ""}এই প্রতিষ্ঠানে অধ্যয়নরত ছিল এবং ` +
                  `${record.reason ? `${record.reason} কারণে ` : ""}প্রতিষ্ঠান ত্যাগ করিতেছে। ` +
                  `তাহার নিকট প্রতিষ্ঠানের কোনো পাওনা নাই।`,
                `This is to certify that ${name}${record.parent_name ? `, child of ${record.parent_name}` : ""}, ` +
                  `studied at this institution${record.session ? ` up to the ${record.session} session` : ""} and is ` +
                  `leaving${record.reason ? ` on the ground of ${record.reason}` : ""}. ` +
                  `The institution has no outstanding claim against him/her.`,
              )}
            </p>
          )}

          <dl className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-micro">
            <Row label={t("শিক্ষার্থী আইডি", "Student ID")} value={record.student_code ? n(record.student_code) : "—"} />
            <Row label={t("শ্রেণি", "Class")} value={record.class_name ?? "—"} />
            <Row label={t("রোল", "Roll")} value={record.roll != null ? n(record.roll) : "—"} />
            <Row label={t("জন্ম তারিখ", "Date of birth")} value={record.dob ? formatDate(record.dob) : "—"} />
            {record.permanent_address ? (
              <div className="col-span-2 flex gap-1.5">
                <dt className="shrink-0 text-neutral-600">{t("স্থায়ী ঠিকানা", "Permanent address")}:</dt>
                <dd className="font-semibold">{record.permanent_address}</dd>
              </div>
            ) : null}
            {!isT && record.cert_type ? <Row label={t("সনদের ধরন", "Certificate type")} value={record.cert_type} /> : null}
          </dl>

          {record.remarks ? (
            <p className="text-micro">
              <span className="text-neutral-600">{t("মন্তব্য", "Remarks")}: </span>
              {record.remarks}
            </p>
          ) : null}
        </div>

        <div className="mt-auto flex items-end justify-between gap-6">
          <div className="flex flex-col items-center gap-1">
            <Qr value={verificationUrl(kind, record.id)} sizeMm={22} />
            <span className="max-w-[30mm] text-center text-micro leading-tight">
              {t("সত্যতা যাচাই করুন", "Scan to verify")}
            </span>
          </div>
          <SignatureBlock
            signatures={signatures}
            roles={["Class Teacher", "Head Teacher"]}
            className="flex-1"
          />
        </div>
      </div>
    </Page>
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
