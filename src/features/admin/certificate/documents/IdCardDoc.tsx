"use client";

import { useT } from "@/shared/i18n/useT";
import { formatDate } from "@/shared/lib/format";
import {
  CARD_LAYOUTS, CR80, Page, Qr, paginate, themeOf, verificationUrl,
  type CardLayout, type LetterheadData,
} from "@/shared/documents";
import type { BatchStudent } from "../logic/documents";

/* eslint-disable @next/next/no-img-element -- see the note in shared/documents/Letterhead.tsx */

/**
 * ID card — ISO/IEC 7810 ID-1 (CR80, 85.6 × 54 mm), the format every school
 * card holder and lanyard sleeve in this market is cut for (SRA A-7 point 1).
 *
 * Laid out in millimetres and printed through `print.css`. The alternative —
 * a server-side PDF renderer — buys a signed archival artefact that nothing
 * in the product needs yet, and costs a headless browser in the deployment.
 */
export function IdCardSheets({
  students,
  batch,
  letterhead,
  photoUrls,
  layout,
}: {
  students: readonly BatchStudent[];
  batch: { theme: string | null; valid_till: string | null; class_name: string; section_name: string | null };
  letterhead: LetterheadData | null | undefined;
  photoUrls: Record<string, string>;
  layout: CardLayout;
}) {
  const { perPage, cols } = CARD_LAYOUTS[layout];
  const pages = paginate(students, perPage);
  return (
    <>
      {pages.map((page, i) => (
        <Page key={i} paper="a4">
          <div
            className="grid h-full content-start justify-center gap-x-4 gap-y-4"
            style={{ gridTemplateColumns: `repeat(${cols}, ${CR80.widthMm}mm)` }}
          >
            {page.map((s) => (
              <IdCard key={s.student_id} student={s} batch={batch} letterhead={letterhead} photoUrl={photoUrls[s.photo_file_id ?? ""]} />
            ))}
          </div>
        </Page>
      ))}
    </>
  );
}

function IdCard({
  student,
  batch,
  letterhead,
  photoUrl,
}: {
  student: BatchStudent;
  batch: { theme: string | null; valid_till: string | null; class_name: string; section_name: string | null };
  letterhead: LetterheadData | null | undefined;
  photoUrl: string | undefined;
}) {
  const { t, n, isBn } = useT();
  const theme = themeOf(batch.theme);
  const name = isBn ? student.name_bn : student.name_en;

  return (
    <article
      className="flex flex-col overflow-hidden rounded-md border"
      style={{ width: `${CR80.widthMm}mm`, height: `${CR80.heightMm}mm`, borderColor: theme.rule }}
    >
      <div className="flex items-center gap-1.5 px-2 py-1" style={{ background: theme.accent, color: theme.onAccent }}>
        {letterhead?.logoUrl ? <img src={letterhead.logoUrl} alt="" className="h-5 w-5 shrink-0 object-contain" /> : null}
        <div className="min-w-0">
          <p className="truncate text-micro font-bold leading-tight">
            {isBn ? letterhead?.name_bn : letterhead?.name_en}
          </p>
          {letterhead?.eiin ? <p className="text-micro leading-tight">EIIN {n(letterhead.eiin)}</p> : null}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-2 px-2 py-1.5">
        <div
          className="flex h-[22mm] w-[18mm] shrink-0 items-center justify-center overflow-hidden rounded-sm border bg-white"
          style={{ borderColor: theme.rule }}
        >
          {photoUrl ? (
            <img src={photoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            // An ID card without a photo is not an ID card (A-7 point 4). The
            // gap is named on the artefact instead of printing a blank box, so
            // the operator sees which students still need one.
            <span className="px-1 text-center text-micro leading-tight text-neutral-500">{t("ছবি নেই", "No photo")}</span>
          )}
        </div>

        <dl className="min-w-0 flex-1 text-micro leading-snug">
          <dd className="truncate text-meta font-bold">{name}</dd>
          <Row label={t("আইডি", "ID")} value={student.student_code ? n(student.student_code) : "—"} />
          <Row label={t("শ্রেণি", "Class")} value={`${batch.class_name}${batch.section_name ? ` · ${batch.section_name}` : ""}`} />
          <Row label={t("রোল", "Roll")} value={student.roll_no != null ? n(student.roll_no) : "—"} />
          {student.blood_group ? <Row label={t("রক্ত", "Blood")} value={student.blood_group} /> : null}
        </dl>

        <div className="flex shrink-0 flex-col items-center justify-end">
          <Qr value={verificationUrl("id", student.student_id)} sizeMm={14} />
        </div>
      </div>

      <div
        className="flex items-center justify-between px-2 py-0.5 text-micro"
        style={{ background: theme.rule }}
      >
        <span>
          {batch.valid_till ? `${t("মেয়াদ", "Valid till")}: ${formatDate(batch.valid_till)}` : ""}
        </span>
        <span className="truncate">{isBn ? letterhead?.address ?? "" : letterhead?.address ?? ""}</span>
      </div>
    </article>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1">
      <dt className="shrink-0 text-neutral-600">{label}:</dt>
      <dd className="min-w-0 flex-1 truncate font-semibold">{value}</dd>
    </div>
  );
}
