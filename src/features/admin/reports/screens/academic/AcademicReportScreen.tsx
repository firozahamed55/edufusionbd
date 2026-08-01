"use client";

import Link from "next/link";
import { Download, GraduationCap } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import {
  Skeleton, ErrorState, EmptyState, Button, buttonClass, Field, Select, Badge,
  Table, THead, TBody, TR, TH, TD,
} from "@/shared/ui";
import { exportCsv } from "@/shared/lib/exportCsv";
import { localDay } from "@/shared/lib/format";
import { useQueryState } from "@/shared/lib/useQueryState";
import { useErrorMessage } from "@/shared/services/errors";
import { ReportShell } from "../../components/ReportShell";
import { useAcademicReport, useReportExams } from "../../logic/hooks";
import { academicFindings } from "../../logic/insights";
import type { AcademicReport } from "../../logic/api";

/**
 * Academic performance (analysis II · R-1).
 *
 * "The single largest gap in the product. A school information system that
 * cannot produce a grade distribution, a pass rate, a subject-difficulty
 * comparison or a class ranking is not yet doing the job it was bought for."
 *
 * The four questions, in the order a head teacher asks them:
 *   1. How did the cohort do?          → pass rate, average GPA
 *   2. What is the spread?             → grade distribution
 *   3. Which subject is the problem?   → subject difficulty, hardest first
 *   4. Which section is the problem?   → class ranking
 *
 * The empty states are load-bearing here. An exam whose marks are in but whose
 * results are not processed has no `exam_result` rows, and rendering that as an
 * empty grade distribution reads as "everybody failed" — the screen says which
 * stage the exam is at instead, and links to the screen that advances it.
 */
export function AcademicReportScreen() {
  const { t, n, isBn } = useT();
  const msg = useErrorMessage();
  const exams = useReportExams();

  const [{ exam: examParam }, setParams] = useQueryState({ exam: "" });
  // Default to the most recent exam rather than an empty screen with a
  // dropdown. The report is almost always about the exam that just finished.
  const examId = examParam || exams.data?.[0]?.id || "";
  const report = useAcademicReport(examId || null);
  const d = report.data;

  const findings = d
    ? academicFindings({
        subjects: d.subjects.map((s) => ({
          name: s.name,
          appeared: s.appeared,
          failed: s.failed,
          averagePct: s.averagePct,
        })),
        passRate: d.passRate,
        appeared: d.appeared,
      })
    : [];

  const selectedExam = exams.data?.find((e) => e.id === examId);
  const maxGrade = Math.max(1, ...(d?.grades ?? []).map((g) => g.students));

  return (
    <ReportShell
      title={t("একাডেমিক ফলাফল", "Academic Performance")}
      subtitle={t(
        "গ্রেড বিন্যাস, পাশের হার, বিষয়ভিত্তিক কাঠিন্য ও শাখার ক্রম",
        "Grade distribution, pass rate, subject difficulty and section ranking",
      )}
      findings={findings}
      provenance={{
        filters: selectedExam
          ? [{ label: t("পরীক্ষা", "Exam"), value: selectedExam.name }]
          : [],
        definitions: [
          {
            term: t("উত্তীর্ণ", "Passed"),
            meaning: t(
              "প্রক্রিয়াকৃত ফলাফলে `pass` — প্রতিটি বিষয়ের নিজস্ব পাশ নম্বর অনুযায়ী",
              "A processed result of `pass`, judged against each subject's own pass mark",
            ),
          },
          {
            term: t("অংশগ্রহণকারী", "Appeared"),
            meaning: t(
              "যাদের প্রক্রিয়াকৃত ফলাফল আছে; অনুপস্থিতদের বিষয়ভিত্তিক গড়ে ধরা হয়নি",
              "Students with a processed result; absentees are excluded from subject averages rather than scored zero",
            ),
          },
        ],
        fetchedAt: report.dataUpdatedAt || undefined,
      }}
      actions={
        <Button
          onClick={() => d && exportCsv(
            `academic-report-${d.examName.replace(/\s+/g, "-").toLowerCase()}-${localDay()}.csv`,
            academicRows(d),
            { kind: "reports.academic", params: { examId: d.examId, exam: d.examName } },
          )}
          disabled={!d || d.appeared === 0}
        >
          <Download size={16} /> {t("এক্সপোর্ট", "Export")}
        </Button>
      }
    >
      <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-surface p-5 shadow-e1" data-print="hide">
        <Field label={t("পরীক্ষা", "Exam")} className="w-72">
          <Select
            value={examId}
            options={(exams.data ?? []).map((e) => ({ value: e.id, label: e.name }))}
            onChange={(e) => setParams({ exam: e.target.value })}
            disabled={exams.isLoading || (exams.data?.length ?? 0) === 0}
          />
        </Field>
        {selectedExam ? (
          <Badge tone={selectedExam.status === "published" ? "success" : "warning"}>{selectedExam.status}</Badge>
        ) : null}
      </div>

      {exams.isLoading || report.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : exams.isError ? (
        <ErrorState title={t("পরীক্ষা তালিকা লোড করা যায়নি", "Could not load exams")} description={msg(exams.error)} />
      ) : (exams.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<GraduationCap size={22} />}
          title={t("এই বছরে কোনো পরীক্ষা নেই", "No exams this academic year")}
          description={t("পরীক্ষা তৈরি করলে এখানে ফলাফল বিশ্লেষণ দেখা যাবে।", "Performance analysis appears here once an exam exists.")}
        />
      ) : report.isError ? (
        <ErrorState title={t("ফলাফল লোড করা যায়নি", "Could not load results")} description={msg(report.error)} />
      ) : !d ? null : d.appeared === 0 ? (
        /*
          The distinction the requirements doc insists on everywhere: a figure
          that is absent because of where the WORKFLOW has got to is not a
          figure about the students. Marks entered but not processed is a
          different sentence from no marks at all, and each names its own next
          step rather than leaving the reader at a blank screen.
        */
        <EmptyState
          icon={<GraduationCap size={22} />}
          title={
            d.marksEntered > 0
              ? t("ফলাফল এখনো প্রক্রিয়া করা হয়নি", "Results have not been processed yet")
              : t("এই পরীক্ষার কোনো মার্ক ইনপুট হয়নি", "No marks have been entered for this exam")
          }
          description={
            d.marksEntered > 0
              ? t(
                  `${n(d.marksEntered)} টি মার্ক রেকর্ড আছে, কিন্তু ফলাফল প্রক্রিয়া না হওয়া পর্যন্ত গ্রেড ও ক্রম গণনা করা যায় না।`,
                  `${d.marksEntered} marks are recorded, but grades and ranking cannot be computed until the results are processed.`,
                )
              : t("মার্ক ইনপুট করার পর ফলাফল প্রক্রিয়া করুন।", "Enter marks, then process the results.")
          }
          action={
            <Link
              href={d.marksEntered > 0 ? "/admin/exam/result-process" : "/admin/exam/mark-input"}
              className={buttonClass("primary")}
            >
              {d.marksEntered > 0 ? t("ফলাফল প্রসেস", "Process results") : t("মার্ক ইনপুট", "Enter marks")}
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label={t("অংশগ্রহণকারী", "Appeared")} value={n(d.appeared)} grad="grad-indigo" />
            <Kpi label={t("উত্তীর্ণ", "Passed")} value={n(d.passed)} sub={d.passRate !== null ? `${n(d.passRate)}%` : undefined} grad="grad-emerald" />
            <Kpi label={t("অনুত্তীর্ণ", "Did not pass")} value={n(d.appeared - d.passed)} grad="grad-amber" />
            <Kpi label={t("গড় জিপিএ", "Average GPA")} value={d.averageGpa !== null ? n(d.averageGpa.toFixed(2)) : "—"} grad="grad-sky" />
          </div>

          {/* --- grade distribution --- */}
          <section className="flex flex-col gap-4 rounded-2xl bg-surface p-5 shadow-e1">
            <Head
              title={t("গ্রেড বিন্যাস", "Grade Distribution")}
              subtitle={t("প্রতিটি গ্রেডে কতজন শিক্ষার্থী", "How many students earned each grade")}
            />
            <div className="flex flex-col gap-3">
              {d.grades.map((g) => (
                <div key={g.grade} className="flex items-center gap-3">
                  <span className="w-14 shrink-0 text-meta font-semibold text-text-secondary">{g.grade}</span>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-sunken">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(g.students / maxGrade) * 100}%` }} />
                  </div>
                  <span className="w-20 shrink-0 text-right text-meta font-semibold text-text-primary tnum">
                    {n(g.students)}
                    <span className="ml-1 font-normal text-text-muted">
                      ({d.appeared > 0 ? ((g.students / d.appeared) * 100).toFixed(1) : "0.0"}%)
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* --- subject difficulty --- */}
          <section className="flex flex-col gap-3">
            <Head
              title={t("বিষয়ভিত্তিক কাঠিন্য", "Subject Difficulty")}
              subtitle={t(
                "সবচেয়ে বেশি অনুত্তীর্ণের হার আগে — এটিই পরের টার্মে যেখানে সাহায্য দরকার",
                "Highest fail rate first — that is where next term's help goes",
              )}
            />
            <Table minWidth={720}>
              <THead>
                <TR>
                  <TH>{t("বিষয়", "Subject")}</TH>
                  <TH className="w-24 text-right">{t("অংশগ্রহণ", "Appeared")}</TH>
                  <TH className="w-24 text-right">{t("অনুপস্থিত", "Absent")}</TH>
                  <TH className="w-24 text-right">{t("অনুত্তীর্ণ", "Failed")}</TH>
                  <TH className="w-24 text-right">{t("ফেল হার", "Fail rate")}</TH>
                  <TH className="w-24 text-right">{t("গড়", "Average")}</TH>
                  <TH className="w-28 text-right">{t("সর্বোচ্চ / সর্বনিম্ন", "High / Low")}</TH>
                </TR>
              </THead>
              <TBody>
                {d.subjects.map((s) => {
                  const failPct = s.appeared > 0 ? (s.failed / s.appeared) * 100 : 0;
                  return (
                    <TR key={s.subjectId}>
                      <TH scope="row" className="text-left text-sm font-semibold text-text-primary">{s.name}</TH>
                      <TD className="text-right text-meta text-text-secondary tnum">{n(s.appeared)}</TD>
                      <TD className="text-right text-meta text-text-muted tnum">{n(s.absent)}</TD>
                      <TD className="text-right text-meta text-text-secondary tnum">{n(s.failed)}</TD>
                      <TD className={cn("text-right text-meta font-semibold tnum", failPct >= 30 ? "text-danger-fg" : failPct >= 15 ? "text-warning-fg" : "text-text-secondary")}>
                        {n(failPct.toFixed(1))}%
                      </TD>
                      <TD className="text-right text-meta text-text-secondary tnum">{n(s.averagePct)}%</TD>
                      <TD className="text-right text-meta text-text-muted tnum">
                        {s.highest !== null ? `${n(s.highest)} / ${n(s.lowest ?? 0)}` : "—"}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </section>

          {/* --- class ranking --- */}
          {d.byClass.length > 0 ? (
            <section className="flex flex-col gap-3">
              <Head
                title={t("শাখাভিত্তিক ক্রম", "Section Ranking")}
                subtitle={t("গড় জিপিএ অনুযায়ী, সর্বোচ্চ আগে", "By average GPA, highest first")}
              />
              <Table minWidth={620}>
                <THead>
                  <TR>
                    <TH className="w-14 text-right">#</TH>
                    <TH>{t("শাখা", "Section")}</TH>
                    <TH className="w-28 text-right">{t("শিক্ষার্থী", "Students")}</TH>
                    <TH className="w-28 text-right">{t("উত্তীর্ণ", "Passed")}</TH>
                    <TH className="w-28 text-right">{t("পাশের হার", "Pass rate")}</TH>
                    <TH className="w-28 text-right">{t("গড় জিপিএ", "Avg GPA")}</TH>
                  </TR>
                </THead>
                <TBody>
                  {d.byClass.map((c, i) => (
                    <TR key={c.classSectionId}>
                      <TD className="text-right text-meta text-text-muted tnum">{n(i + 1)}</TD>
                      <TH scope="row" className="text-left text-sm font-semibold text-text-primary">
                        {isBn ? c.label_bn : c.label_en}
                      </TH>
                      <TD className="text-right text-meta text-text-secondary tnum">{n(c.students)}</TD>
                      <TD className="text-right text-meta text-text-secondary tnum">{n(c.passed)}</TD>
                      <TD className="text-right text-meta text-text-secondary tnum">
                        {n(((c.passed / Math.max(1, c.students)) * 100).toFixed(1))}%
                      </TD>
                      <TD className="text-right text-meta font-semibold text-text-primary tnum">
                        {c.averageGpa !== null ? n(c.averageGpa.toFixed(2)) : "—"}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </section>
          ) : null}
        </>
      )}
    </ReportShell>
  );
}

/* ---------- export ---------- */

function academicRows(d: AcademicReport) {
  const rows: Record<string, string | number>[] = [];
  rows.push({ Section: "Summary", Item: "Exam", Value: d.examName, Detail: d.examStatus });
  rows.push({ Section: "Summary", Item: "Appeared", Value: d.appeared, Detail: "" });
  rows.push({ Section: "Summary", Item: "Passed", Value: d.passed, Detail: d.passRate !== null ? `${d.passRate}%` : "" });
  rows.push({ Section: "Summary", Item: "Average GPA", Value: d.averageGpa ?? "", Detail: "" });
  for (const g of d.grades) {
    rows.push({ Section: "Grade", Item: g.grade, Value: g.students, Detail: `GPA ${g.gpa}` });
  }
  for (const s of d.subjects) {
    rows.push({ Section: "Subject · appeared", Item: s.name, Value: s.appeared, Detail: "" });
    rows.push({ Section: "Subject · absent", Item: s.name, Value: s.absent, Detail: "" });
    rows.push({ Section: "Subject · failed", Item: s.name, Value: s.failed, Detail: s.appeared > 0 ? `${((s.failed / s.appeared) * 100).toFixed(1)}%` : "" });
    rows.push({ Section: "Subject · average %", Item: s.name, Value: s.averagePct, Detail: "" });
  }
  for (const c of d.byClass) {
    rows.push({ Section: "Section · students", Item: c.label_en, Value: c.students, Detail: "" });
    rows.push({ Section: "Section · passed", Item: c.label_en, Value: c.passed, Detail: "" });
    rows.push({ Section: "Section · avg GPA", Item: c.label_en, Value: c.averageGpa ?? "", Detail: "" });
  }
  return rows;
}

/* ---------- local parts ---------- */

function Kpi({ label, value, sub, grad }: { label: string; value: string; sub?: string; grad: string }) {
  return (
    <div className={cn("flex flex-col gap-3 rounded-2xl px-5 py-4.5 text-white shadow-e2", grad)}>
      <p className="text-meta font-medium opacity-90">{label}</p>
      <p className="text-3xl font-bold tnum">{value}</p>
      <p className="text-meta font-semibold opacity-90">{sub ?? " "}</p>
    </div>
  );
}

function Head({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <p className="text-base font-semibold text-text-primary">{title}</p>
      {subtitle ? <p className="mt-0.5 text-meta text-text-muted">{subtitle}</p> : null}
    </div>
  );
}
