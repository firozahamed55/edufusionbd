"use client";

import { Download, TrendingUp, Users } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { RELIGION, STUDENT_STATUS } from "@/shared/constants/enums";
import {
  Skeleton, ErrorState, EmptyState, Button, PageHeader,
  Table, THead, TBody, TR, TH, TD,
} from "@/shared/ui";
import { exportCsv } from "@/shared/lib/exportCsv";
import { localDay } from "@/shared/lib/format";
import { useStudentReport } from "../../logic/hooks";
import { useErrorMessage } from "@/shared/services/errors";

/**
 * Student · Reports Summary — live enrollment / gender / class / religion / age
 * statistics from fn_student_report_summary (RLS-scoped, current academic year).
 * "Stats dashboard" archetype: gradient KPIs + bar charts + breakdown tables.
 */

const AGE_ORDER = ["5-8", "9-11", "12-14", "15-17", "other"] as const;
const AGE_LABELS: Record<string, [string, string]> = {
  "5-8": ["৫–৮ বছর", "5–8 yrs"],
  "9-11": ["৯–১১ বছর", "9–11 yrs"],
  "12-14": ["১২–১৪ বছর", "12–14 yrs"],
  "15-17": ["১৫–১৭ বছর", "15–17 yrs"],
  other: ["অন্যান্য", "Other"],
};

export function ReportsSummaryScreen() {
  const { t, n, isBn } = useT();
  const msg = useErrorMessage();
  const report = useStudentReport();

  const pct = (part: number, whole: number) => (whole > 0 ? ((part / whole) * 100).toFixed(1) : "0.0");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start gap-3">
        <PageHeader
          className="flex-1"
          crumbs={[{ label: t("শিক্ষার্থী", "Students"), href: "/admin/student/update-class" }, { label: t("শিক্ষার্থী সারসংক্ষেপ", "Student Summary") }]}
          title={t("শিক্ষার্থী সারসংক্ষেপ", "Student Summary")}
          subtitle={t("ভর্তিভুক্তি, লিঙ্গ ও শ্রেণিভিত্তিক পরিসংখ্যান", "Enrollment, gender & class-wise statistics")}
        />
        <Button
          onClick={() => report.data && exportCsv(
            // Institution time. `toISOString().slice(0,10)` names the file
            // "yesterday" for anyone exporting after 18:00 in Dhaka (A-0.8).
            `student-summary-${localDay()}.csv`,
            report.data.by_class.map((c) => ({
              Class: c.name_en,
              Sections: c.sections,
              Boys: c.boys,
              Girls: c.girls,
              Total: c.total,
            })),
          )}
          disabled={!report.data}
        >
          <Download size={16} /> {t("এক্সপোর্ট", "Export")}
        </Button>
      </div>

      {report.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : report.isError ? (
        <ErrorState title={t("রিপোর্ট লোড করা যায়নি", "Could not load report")} description={msg(report.error)} />
      ) : !report.data || report.data.total === 0 ? (
        <EmptyState icon={<Users size={22} />} title={t("কোনো শিক্ষার্থী নেই", "No students yet")} description={t("শিক্ষার্থী ভর্তি করলে এখানে পরিসংখ্যান দেখা যাবে।", "Statistics appear here once students are enrolled.")} />
      ) : (
        (() => {
          const d = report.data;
          const maxClass = Math.max(1, ...d.by_class.map((c) => c.total));
          const religionEntries = RELIGION.map((r) => ({ label: isBn ? r.bn : r.en, value: d.by_religion[r.value] ?? 0 })).filter((r) => r.value > 0);
          const maxReligion = Math.max(1, ...religionEntries.map((r) => r.value));
          const ageEntries = AGE_ORDER.filter((k) => (d.by_age[k] ?? 0) > 0).map((k) => ({ label: t(AGE_LABELS[k][0], AGE_LABELS[k][1]), value: d.by_age[k] }));
          const maxAge = Math.max(1, ...ageEntries.map((a) => a.value));
          const KPIS = [
            { label: t("মোট শিক্ষার্থী", "Total Students"), value: d.total, grad: "grad-indigo", shadow: "shadow-e2", up: true },
            { label: t("ছেলে", "Boys"), value: d.boys, sub: `${pct(d.boys, d.total)}%`, grad: "grad-emerald", shadow: "shadow-e2" },
            { label: t("মেয়ে", "Girls"), value: d.girls, sub: `${pct(d.girls, d.total)}%`, grad: "grad-sky", shadow: "shadow-e2" },
            { label: t("সক্রিয়", "Active"), value: d.status["active"] ?? 0, grad: "grad-amber", shadow: "shadow-e2" },
          ];

          return (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {KPIS.map((k) => (
                  <div key={k.label} className={cn("flex flex-col gap-3 rounded-2xl px-5 py-4.5 text-white", k.grad, k.shadow)}>
                    <p className="text-meta font-medium opacity-90">{k.label}</p>
                    <p className="text-3xl font-bold tnum">{n(k.value)}</p>
                    <div className="flex items-center gap-1.5 text-meta opacity-90">
                      {k.up ? <TrendingUp size={13} /> : null}
                      {k.sub ? <span className="font-semibold">{k.sub}</span> : <span className="opacity-70">{t("শিক্ষাবর্ষ চলমান", "Current year")}</span>}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
                <Card>
                  <CardHead title={t("শ্রেণিভিত্তিক শিক্ষার্থী", "Students per Class")} subtitle={t("প্রতিটি শ্রেণিতে মোট শিক্ষার্থী সংখ্যা", "Total students in each class")} />
                  <div className="mt-2 flex flex-col gap-3">
                    {d.by_class.map((b) => (
                      <div key={b.numeric_level} className="flex items-center gap-3">
                        <span className="w-16 shrink-0 truncate text-meta font-medium text-text-secondary">{isBn ? b.name_bn : b.name_en}</span>
                        <div className="h-3 flex-1 overflow-hidden rounded-full bg-sunken">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${(b.total / maxClass) * 100}%` }} />
                        </div>
                        <span className="w-12 shrink-0 text-right text-meta font-semibold text-text-primary tnum">{n(b.total)}</span>
                      </div>
                    ))}
                  </div>
                </Card>

                <div className="flex flex-col gap-4">
                  <Card>
                    <CardHead title={t("লিঙ্গ অনুপাত", "Gender Ratio")} />
                    <div className="mt-1 flex h-3 overflow-hidden rounded-full bg-sunken">
                      <div className="h-full bg-primary" style={{ width: `${pct(d.boys, d.total)}%` }} />
                      <div className="h-full bg-indigo-400" style={{ width: `${pct(d.girls, d.total)}%` }} />
                    </div>
                    <div className="mt-1 flex flex-col gap-2">
                      <LegendRow color="bg-primary" label={`${t("ছেলে", "Boys")} — ${pct(d.boys, d.total)}%`} />
                      <LegendRow color="bg-indigo-400" label={`${t("মেয়ে", "Girls")} — ${pct(d.girls, d.total)}%`} />
                    </div>
                  </Card>
                  <Card>
                    <CardHead title={t("স্ট্যাটাস বিন্যাস", "Status Distribution")} />
                    <div className="flex flex-col gap-2.5">
                      {STUDENT_STATUS.map((st) => (
                        <StatRow key={st.value} label={isBn ? st.bn : st.en} value={n(d.status[st.value] ?? 0)}
                          tone={st.value === "active" ? "text-success-fg" : st.value === "transferred" ? "text-warning-fg" : "text-text-secondary"} />
                      ))}
                    </div>
                  </Card>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <CardHead title={t("শ্রেণিভিত্তিক বিন্যাস (লিঙ্গসহ)", "Class Distribution (by gender)")} subtitle={t("প্রতি শ্রেণিতে শাখা, ছেলে, মেয়ে ও মোট শিক্ষার্থী", "Sections, boys, girls & total per class")} />
                {/* Six numeric columns per class, with a grand total. It was
                    nested flex <div>s, so nothing associated a number with its
                    column or marked the total row as a total (SRA A-0.7). */}
                <Table minWidth={720}>
                  <THead>
                    <TR>
                      <TH>{t("শ্রেণি", "Class")}</TH>
                      <TH className="w-22.5 text-right">{t("শাখা", "Sections")}</TH>
                      <TH className="w-22.5 text-right">{t("ছেলে", "Boys")}</TH>
                      <TH className="w-22.5 text-right">{t("মেয়ে", "Girls")}</TH>
                      <TH className="w-22.5 text-right">{t("মোট", "Total")}</TH>
                      <TH className="w-22.5 text-right">{t("শতকরা", "Percent")}</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {d.by_class.map((c) => (
                      <TR key={c.numeric_level}>
                        <TH scope="row" className="text-left text-sm font-semibold text-text-primary">{isBn ? c.name_bn : c.name_en}</TH>
                        <TD className="text-right text-meta text-text-secondary tnum">{n(c.sections)}</TD>
                        <TD className="text-right text-meta text-text-secondary tnum">{n(c.boys)}</TD>
                        <TD className="text-right text-meta text-text-secondary tnum">{n(c.girls)}</TD>
                        <TD className="text-right text-meta font-semibold text-text-primary tnum">{n(c.total)}</TD>
                        <TD className="text-right text-meta font-medium text-primary">{pct(c.total, d.total)}%</TD>
                      </TR>
                    ))}
                  </TBody>
                  <tfoot>
                    <tr className="border-t border-border-strong bg-sunken text-meta font-bold text-text-primary">
                      <th scope="row" className="px-5 py-3 text-left">{t("সর্বমোট", "Grand total")}</th>
                      <td className="px-5 py-3 text-right">—</td>
                      <td className="px-5 py-3 text-right tnum">{n(d.boys)}</td>
                      <td className="px-5 py-3 text-right tnum">{n(d.girls)}</td>
                      <td className="px-5 py-3 text-right tnum">{n(d.total)}</td>
                      <td className="px-5 py-3 text-right">100%</td>
                    </tr>
                  </tfoot>
                </Table>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {religionEntries.length > 0 && (
                  <BreakdownCard title={t("ধর্মভিত্তিক বিন্যাস", "Religion Distribution")} subtitle={t("শিক্ষার্থীদের ধর্ম অনুযায়ী সংখ্যা", "Students by religion")}
                    rows={religionEntries.map((r) => ({ label: r.label, value: r.value, right: `${n(r.value)} (${pct(r.value, d.total)}%)` }))} maxValue={maxReligion} />
                )}
                {ageEntries.length > 0 && (
                  <BreakdownCard title={t("বয়সভিত্তিক বিন্যাস", "Age Distribution")} subtitle={t("বয়স গোষ্ঠী অনুযায়ী শিক্ষার্থী সংখ্যা", "Students by age group")}
                    rows={ageEntries.map((a) => ({ label: a.label, value: a.value, right: n(a.value) }))} maxValue={maxAge} />
                )}
              </div>
            </>
          );
        })()
      )}
    </div>
  );
}

/* ---------- local parts ---------- */

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-4 rounded-2xl bg-surface p-5 shadow-e1", className)}>{children}</div>;
}

function CardHead({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <p className="text-base font-semibold text-text-primary">{title}</p>
      {subtitle ? <p className="mt-0.5 text-meta text-text-muted">{subtitle}</p> : null}
    </div>
  );
}

function BreakdownCard({ title, subtitle, rows, maxValue }: { title: string; subtitle: string; rows: { label: string; value: number; right: string }[]; maxValue: number }) {
  return (
    <Card>
      <CardHead title={title} subtitle={subtitle} />
      <div className="mt-1 flex flex-col gap-3">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3">
            <span className="w-23 shrink-0 text-meta text-text-secondary">{r.label}</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-sunken">
              <div className="h-full rounded-full bg-primary" style={{ width: `${(r.value / maxValue) * 100}%` }} />
            </div>
            <span className="w-23 shrink-0 text-right text-meta font-semibold text-text-primary">{r.right}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2 text-meta text-text-secondary">
      <span className={cn("size-2.5 rounded-full", color)} />
      {label}
    </div>
  );
}

function StatRow({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="flex items-center">
      <span className="flex-1 text-meta text-text-secondary">{label}</span>
      <span className={cn("text-sm font-bold tnum", tone)}>{value}</span>
    </div>
  );
}
