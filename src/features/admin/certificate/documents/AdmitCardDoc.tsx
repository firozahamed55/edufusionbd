"use client";

import { useT } from "@/shared/i18n/useT";
import { formatDate } from "@/shared/lib/format";
import { Page, Qr, Letterhead, paginate, themeOf, verificationUrl, type LetterheadData } from "@/shared/documents";
import type { BatchStudent } from "../logic/documents";

/* eslint-disable @next/next/no-img-element -- see the note in shared/documents/Letterhead.tsx */

export type AdmitBatchInfo = {
  theme: string | null;
  exam_name: string | null;
  center: string | null;
  issue_date: string | null;
  class_name: string;
  section_name: string | null;
};

/** Exam subjects and dates printed on the card, from `exam_date_config`. */
export type AdmitSubject = { name: string; date: string | null; time: string | null };

/**
 * Admit card — two to an A4 sheet, which is how a school actually prints them:
 * one cut down the middle, no card stock, no guillotine setup.
 *
 * Everything on it comes from a record. The exam name, centre and issue date
 * are the batch's; the seat number is `admit_card.seat_no` when a seat plan
 * assigned one, and is printed blank rather than invented when it did not.
 */
export function AdmitCardSheets({
  students,
  batch,
  letterhead,
  photoUrls,
  seats,
  subjects,
  instructions,
}: {
  students: readonly BatchStudent[];
  batch: AdmitBatchInfo;
  letterhead: LetterheadData | null | undefined;
  photoUrls: Record<string, string>;
  seats: Record<string, string>;
  subjects: readonly AdmitSubject[];
  instructions: readonly string[];
}) {
  const pages = paginate(students, 2);
  return (
    <>
      {pages.map((page, i) => (
        <Page key={i} paper="a4">
          <div className="flex h-full flex-col gap-4">
            {page.map((s) => (
              <AdmitCard
                key={s.student_id}
                student={s}
                batch={batch}
                letterhead={letterhead}
                photoUrl={photoUrls[s.photo_file_id ?? ""]}
                seat={seats[s.student_id] ?? null}
                subjects={subjects}
                instructions={instructions}
              />
            ))}
          </div>
        </Page>
      ))}
    </>
  );
}

function AdmitCard({
  student, batch, letterhead, photoUrl, seat, subjects, instructions,
}: {
  student: BatchStudent;
  batch: AdmitBatchInfo;
  letterhead: LetterheadData | null | undefined;
  photoUrl: string | undefined;
  seat: string | null;
  subjects: readonly AdmitSubject[];
  instructions: readonly string[];
}) {
  const { t, n, isBn } = useT();
  const theme = themeOf(batch.theme);

  return (
    <article className="flex flex-1 flex-col gap-2 rounded-md border p-3" style={{ borderColor: theme.rule }}>
      <Letterhead data={letterhead} className="border-b" />
      <p
        className="self-center rounded-sm px-3 py-0.5 text-meta font-bold tracking-wide"
        style={{ background: theme.accent, color: theme.onAccent }}
      >
        {t("প্রবেশপত্র", "ADMIT CARD")}
        {batch.exam_name ? ` — ${batch.exam_name}` : ""}
      </p>

      <div className="flex gap-3">
        <dl className="grid flex-1 grid-cols-2 gap-x-3 gap-y-0.5 text-meta">
          <Row label={t("শিক্ষার্থী", "Student")} value={isBn ? student.name_bn : student.name_en} wide />
          <Row label={t("আইডি", "ID")} value={student.student_code ? n(student.student_code) : "—"} />
          <Row label={t("রোল", "Roll")} value={student.roll_no != null ? n(student.roll_no) : "—"} />
          <Row label={t("শ্রেণি", "Class")} value={`${batch.class_name}${batch.section_name ? ` · ${batch.section_name}` : ""}`} />
          <Row label={t("আসন", "Seat")} value={seat ? n(seat) : "—"} />
          <Row label={t("কেন্দ্র", "Centre")} value={batch.center ?? "—"} />
          <Row label={t("ইস্যু", "Issued")} value={batch.issue_date ? formatDate(batch.issue_date) : "—"} />
        </dl>
        <div className="flex shrink-0 flex-col items-center gap-1">
          <div className="flex h-[28mm] w-[23mm] items-center justify-center overflow-hidden border bg-white" style={{ borderColor: theme.rule }}>
            {photoUrl ? <img src={photoUrl} alt="" className="h-full w-full object-cover" />
              : <span className="px-1 text-center text-micro leading-tight text-neutral-500">{t("ছবি নেই", "No photo")}</span>}
          </div>
          <Qr value={verificationUrl("admit", student.student_id)} sizeMm={16} />
        </div>
      </div>

      {subjects.length > 0 ? (
        <table className="w-full border-collapse text-micro">
          <thead>
            <tr style={{ background: theme.rule }}>
              <th className="border px-1.5 py-0.5 text-left" style={{ borderColor: theme.rule }}>{t("বিষয়", "Subject")}</th>
              <th className="border px-1.5 py-0.5 text-left" style={{ borderColor: theme.rule }}>{t("তারিখ", "Date")}</th>
              <th className="border px-1.5 py-0.5 text-left" style={{ borderColor: theme.rule }}>{t("সময়", "Time")}</th>
            </tr>
          </thead>
          <tbody>
            {subjects.map((s) => (
              <tr key={s.name}>
                <td className="border px-1.5 py-0.5" style={{ borderColor: theme.rule }}>{s.name}</td>
                <td className="border px-1.5 py-0.5" style={{ borderColor: theme.rule }}>{s.date ? formatDate(s.date) : "—"}</td>
                <td className="border px-1.5 py-0.5" style={{ borderColor: theme.rule }}>{s.time ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {instructions.length > 0 ? (
        <ol className="list-inside list-decimal text-micro leading-snug">
          {instructions.map((line, i) => <li key={i}>{line}</li>)}
        </ol>
      ) : null}

      <div className="mt-auto flex items-end justify-between pt-2 text-micro">
        <span className="w-40 border-t border-black pt-0.5 text-center">{t("শিক্ষার্থীর স্বাক্ষর", "Student signature")}</span>
        <span className="w-40 border-t border-black pt-0.5 text-center">{t("কেন্দ্র সচিব", "Centre secretary")}</span>
      </div>
    </article>
  );
}

function Row({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2 flex gap-1.5" : "flex gap-1.5"}>
      <dt className="shrink-0 text-neutral-600">{label}:</dt>
      <dd className="min-w-0 flex-1 truncate font-semibold">{value}</dd>
    </div>
  );
}
