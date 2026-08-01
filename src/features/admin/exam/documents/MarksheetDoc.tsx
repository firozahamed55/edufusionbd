"use client";

import { useT } from "@/shared/i18n/useT";
import { formatDate } from "@/shared/lib/format";
import { Page, Letterhead, SignatureBlock, type LetterheadData, type DocSignature } from "@/shared/documents";
import type { TabRow, TabSubject, ResultStats } from "../logic/results";

/**
 * Individual marksheet / report card (SRA A-5.2).
 *
 * "The Documents module configures a marksheet that the Exam module cannot
 * produce" — `marksheet-config` has existed as a screen since the module
 * shipped, with nothing reading it. This template reads it.
 *
 * One student per A5 half so a section prints two-up and is cut once.
 */
export type MarksheetConfig = {
  show_position?: boolean;
  show_attendance?: boolean;
  show_comment?: boolean;
  comment?: string;
  footer_note?: string;
};

export function MarksheetSheets({
  rows,
  subjects,
  stats,
  examName,
  sectionLabel,
  config,
  letterhead,
  signatures,
}: {
  rows: readonly TabRow[];
  subjects: readonly TabSubject[];
  stats: ResultStats;
  examName: string;
  sectionLabel: string;
  config: MarksheetConfig;
  letterhead: LetterheadData | null | undefined;
  signatures: readonly DocSignature[] | undefined;
}) {
  return (
    <>
      {rows.map((row) => (
        <Page key={row.student_id} paper="a5" className="text-micro">
          <Marksheet
            row={row}
            subjects={subjects}
            stats={stats}
            examName={examName}
            sectionLabel={sectionLabel}
            config={config}
            letterhead={letterhead}
            signatures={signatures}
          />
        </Page>
      ))}
    </>
  );
}

function Marksheet({
  row, subjects, stats, examName, sectionLabel, config, letterhead, signatures,
}: {
  row: TabRow;
  subjects: readonly TabSubject[];
  stats: ResultStats;
  examName: string;
  sectionLabel: string;
  config: MarksheetConfig;
  letterhead: LetterheadData | null | undefined;
  signatures: readonly DocSignature[] | undefined;
}) {
  const { t, n, isBn } = useT();
  return (
    <div className="flex h-full flex-col gap-2">
      <Letterhead data={letterhead} className="pb-1.5" />
      <p className="self-center border-b border-black px-4 pb-0.5 text-meta font-bold tracking-wide">
        {t("নম্বরপত্র", "MARKSHEET")} — {examName}
      </p>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5">
        <Row label={t("শিক্ষার্থী", "Student")} value={isBn ? row.name_bn : row.name_en} />
        <Row label={t("আইডি", "ID")} value={row.student_code ? n(row.student_code) : "—"} />
        <Row label={t("শ্রেণি", "Class")} value={sectionLabel} />
        <Row label={t("রোল", "Roll")} value={row.roll != null ? n(row.roll) : "—"} />
      </dl>

      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-neutral-200">
            <th className="border border-black px-1 py-0.5 text-left">{t("বিষয়", "Subject")}</th>
            <th className="border border-black px-1 py-0.5 text-center">{t("পূর্ণমান", "Full")}</th>
            <th className="border border-black px-1 py-0.5 text-center">{t("পাস", "Pass")}</th>
            <th className="border border-black px-1 py-0.5 text-center">{t("প্রাপ্ত", "Obtained")}</th>
          </tr>
        </thead>
        <tbody>
          {subjects.map((s) => {
            const cell = row.marks[s.subject_id];
            return (
              <tr key={s.subject_id}>
                <td className="border border-black px-1 py-0.5">{isBn ? s.name_bn : s.name_en}</td>
                <td className="border border-black px-1 py-0.5 text-center tnum">{s.full_marks != null ? n(s.full_marks) : "—"}</td>
                <td className="border border-black px-1 py-0.5 text-center tnum">{s.pass_marks != null ? n(s.pass_marks) : "—"}</td>
                <td className="border border-black px-1 py-0.5 text-center tnum">
                  {cell?.absent ? t("অনুপস্থিত", "Absent") : cell?.marks != null ? n(cell.marks) : "—"}
                </td>
              </tr>
            );
          })}
          <tr className="font-bold">
            <td className="border border-black px-1 py-0.5" colSpan={3}>{t("মোট", "Total")}</td>
            <td className="border border-black px-1 py-0.5 text-center tnum">{row.total != null ? n(row.total) : "—"}</td>
          </tr>
        </tbody>
      </table>

      <dl className="grid grid-cols-3 gap-x-3 gap-y-0.5">
        <Row label="GPA" value={row.gpa != null ? n(row.gpa) : "—"} />
        <Row label={t("গ্রেড", "Grade")} value={row.grade ?? "—"} />
        <Row label={t("ফলাফল", "Result")} value={row.result === "pass" ? t("উত্তীর্ণ", "Pass") : row.result === "fail" ? t("অকৃতকার্য", "Fail") : "—"} />
        {config.show_position ? (
          <Row label={t("মেধাক্রম", "Position")} value={row.merit != null ? `${n(row.merit)} / ${n(stats.appeared)}` : "—"} />
        ) : null}
      </dl>

      {config.show_comment && config.comment ? (
        <p className="rounded-sm border border-black px-2 py-1">
          <span className="text-neutral-600">{t("মন্তব্য", "Comment")}: </span>
          {config.comment}
        </p>
      ) : null}

      <div className="mt-auto flex items-end justify-between gap-4 pt-2">
        <p className="text-neutral-600">
          {config.footer_note ? `${config.footer_note} · ` : ""}
          {t("প্রকাশ", "Issued")}: {formatDate(new Date())}
        </p>
        <SignatureBlock signatures={signatures} roles={["Class Teacher", "Head Teacher"]} className="w-56" />
      </div>
    </div>
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
