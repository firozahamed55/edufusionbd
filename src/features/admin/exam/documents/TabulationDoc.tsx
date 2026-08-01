"use client";

import { useT } from "@/shared/i18n/useT";
import { Page, Letterhead, SignatureBlock, paginate, type LetterheadData, type DocSignature } from "@/shared/documents";
import type { Tabulation } from "../logic/results";

/**
 * Tabulation sheet — "the artefact schools actually produce" (SRA A-5.2).
 *
 * Subject × student matrix, landscape A4, 22 students to a page. Landscape
 * because a Bangladeshi secondary section sits 10–12 subjects, and the matrix
 * is unreadable when the subject columns are 9 mm wide.
 *
 * The header repeats on every page (`thead` + the print rule in globals.css),
 * because a 400-row sheet whose column labels appear only on page 1 is exactly
 * the artefact the old `window.print()` produced.
 */
export function TabulationSheets({
  tabulation,
  examName,
  sectionLabel,
  letterhead,
  signatures,
}: {
  tabulation: Tabulation;
  examName: string;
  sectionLabel: string;
  letterhead: LetterheadData | null | undefined;
  signatures: readonly DocSignature[] | undefined;
}) {
  const { t, n, isBn } = useT();
  const { subjects, rows, stats } = tabulation;
  const pages = paginate(rows, 22);

  return (
    <>
      {pages.map((page, pageIndex) => (
        <Page key={pageIndex} paper="a4-landscape" className="text-micro">
          <div className="flex h-full flex-col gap-2">
            <Letterhead data={letterhead} className="pb-1.5" />
            <div className="flex items-baseline justify-between">
              <h2 className="text-meta font-bold tracking-wide">{t("ট্যাবুলেশন শীট", "TABULATION SHEET")}</h2>
              <span>{examName} · {sectionLabel}</span>
              <span>{t("পৃষ্ঠা", "Page")} {n(pageIndex + 1)} / {n(pages.length)}</span>
            </div>

            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-neutral-200">
                  <th className="border border-black px-1 py-0.5 text-left">{t("মেধা", "Rank")}</th>
                  <th className="border border-black px-1 py-0.5 text-left">{t("রোল", "Roll")}</th>
                  <th className="border border-black px-1 py-0.5 text-left">{t("শিক্ষার্থী", "Student")}</th>
                  {subjects.map((s) => (
                    <th key={s.subject_id} className="border border-black px-1 py-0.5 text-center">
                      <span className="block">{isBn ? s.name_bn : s.name_en}</span>
                      <span className="block font-normal">{s.full_marks != null ? n(s.full_marks) : "—"}</span>
                    </th>
                  ))}
                  <th className="border border-black px-1 py-0.5 text-right">{t("মোট", "Total")}</th>
                  <th className="border border-black px-1 py-0.5 text-center">GPA</th>
                  <th className="border border-black px-1 py-0.5 text-center">{t("গ্রেড", "Grade")}</th>
                  <th className="border border-black px-1 py-0.5 text-center">{t("ফলাফল", "Result")}</th>
                </tr>
              </thead>
              <tbody>
                {page.map((r) => (
                  <tr key={r.student_id}>
                    <td className="border border-black px-1 py-0.5 tnum">{r.merit != null ? n(r.merit) : "—"}</td>
                    <td className="border border-black px-1 py-0.5 tnum">{r.roll != null ? n(r.roll) : "—"}</td>
                    <td className="border border-black px-1 py-0.5">{isBn ? r.name_bn : r.name_en}</td>
                    {subjects.map((s) => {
                      const cell = r.marks[s.subject_id];
                      return (
                        <td key={s.subject_id} className="border border-black px-1 py-0.5 text-center tnum">
                          {/* Absent is not zero. A blank prints as "did not sit",
                              a 0 prints as "sat and scored nothing", and the
                              distinction changes whether a re-sit is owed. */}
                          {cell?.absent ? t("অনু", "A") : cell?.marks != null ? n(cell.marks) : "—"}
                        </td>
                      );
                    })}
                    <td className="border border-black px-1 py-0.5 text-right font-semibold tnum">{r.total != null ? n(r.total) : "—"}</td>
                    <td className="border border-black px-1 py-0.5 text-center tnum">{r.gpa != null ? n(r.gpa) : "—"}</td>
                    <td className="border border-black px-1 py-0.5 text-center font-semibold">{r.grade ?? "—"}</td>
                    <td className="border border-black px-1 py-0.5 text-center">
                      {r.result === "pass" ? t("উত্তীর্ণ", "Pass") : r.result === "fail" ? t("অকৃতকার্য", "Fail") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {pageIndex === pages.length - 1 ? (
              <div className="mt-auto flex items-end justify-between gap-6 pt-3">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                  <Stat label={t("অংশগ্রহণ", "Appeared")} value={n(stats.appeared)} />
                  <Stat label={t("উত্তীর্ণ", "Passed")} value={n(stats.passed)} />
                  <Stat label={t("পাসের হার", "Pass rate")} value={`${n(stats.pass_rate)}%`} />
                  <Stat label={t("গড় GPA", "Average GPA")} value={n(stats.avg_gpa)} />
                  <Stat label={t("সর্বোচ্চ", "Highest")} value={n(stats.highest)} />
                  <Stat label={t("সর্বনিম্ন", "Lowest")} value={n(stats.lowest)} />
                </dl>
                <SignatureBlock signatures={signatures} roles={["Exam Controller", "Head Teacher"]} className="flex-1" />
              </div>
            ) : null}
          </div>
        </Page>
      ))}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1.5">
      <dt className="shrink-0 text-neutral-600">{label}:</dt>
      <dd className="font-semibold tnum">{value}</dd>
    </div>
  );
}
