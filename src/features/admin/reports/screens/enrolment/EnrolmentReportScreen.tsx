"use client";

import { AlertTriangle, Download, Users } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { RELIGION, GENDER, STUDENT_STATUS } from "@/shared/constants/enums";
import {
  Skeleton, ErrorState, EmptyState, Button,
  Table, THead, TBody, TR, TH, TD,
} from "@/shared/ui";
import { exportCsv } from "@/shared/lib/exportCsv";
import { localDay } from "@/shared/lib/format";
import { useQueryState } from "@/shared/lib/useQueryState";
import { useErrorMessage } from "@/shared/services/errors";
import { useClasses, useClassSectionsLookup } from "@/shared/services/lookups/hooks";
import { ReportShell } from "../../components/ReportShell";
import { ReportFilters } from "../../components/ReportFilters";
import { useEnrolmentReport, useShifts } from "../../logic/hooks";
import { enrolmentFindings } from "../../logic/insights";
import type { EnrolmentFilters, EnrolmentReport } from "../../logic/api";

/**
 * Enrolment & demographics (analysis II · R-5, R-3, R-8, R-9).
 *
 * This is the Student-module reports screen, moved into Reports and given the
 * four things the cross-cutting contract said it owed and did not deliver:
 * filters, an interpretation layer, print, and provenance. The tables
 * themselves are unchanged — they were the two things it already did well.
 */

type ReligionKey = "islam" | "hindu" | "christian" | "buddhist" | "other";

const AGE_ORDER = ["5-8", "9-11", "12-14", "15-17", "other"] as const;
const AGE_LABELS: Record<string, [string, string]> = {
  "5-8": ["৫–৮ বছর", "5–8 yrs"],
  "9-11": ["৯–১১ বছর", "9–11 yrs"],
  "12-14": ["১২–১৪ বছর", "12–14 yrs"],
  "15-17": ["১৫–১৭ বছর", "15–17 yrs"],
  other: ["অন্যান্য", "Other"],
};

/** The URL's filter shape. Empty string = absent, per `useQueryState`. */
const FILTER_DEFAULTS = {
  class_id: "",
  class_section_id: "",
  shift_id: "",
  gender: "",
  religion: "",
  admitted_from: "",
  admitted_to: "",
};

export function EnrolmentReportScreen() {
  const { t, n, isBn } = useT();
  const msg = useErrorMessage();

  // R-5. The filters are the report's ADDRESS — "girls in Class Five" has to
  // be a link, or it cannot be sent to anyone or cited in a printed return.
  const [filters, setFilters] = useQueryState(FILTER_DEFAULTS);
  const report = useEnrolmentReport(filters as EnrolmentFilters);

  // Lookups, for turning the ids in the URL back into names on the
  // provenance line. A printed report that says `class_id: 3f2a…` is not
  // stating its filters in any sense a reader can use.
  const classes = useClasses();
  const sections = useClassSectionsLookup();
  const shifts = useShifts();
  const nameOf = (rows: { value: string; label_bn: string; label_en: string }[] | undefined, id: string) => {
    const hit = rows?.find((r) => r.value === id);
    return hit ? (isBn ? hit.label_bn : hit.label_en) : id;
  };
  const enumName = (rows: { value: string; bn: string; en: string }[], v: string) => {
    const hit = rows.find((r) => r.value === v);
    return hit ? (isBn ? hit.bn : hit.en) : v;
  };

  const appliedFilters = [
    filters.class_id && { label: t("শ্রেণি", "Class"), value: nameOf(classes.data, filters.class_id) },
    filters.class_section_id && { label: t("শাখা", "Section"), value: nameOf(sections.data, filters.class_section_id) },
    filters.shift_id && { label: t("শিফট", "Shift"), value: nameOf(shifts.data, filters.shift_id) },
    filters.gender && { label: t("লিঙ্গ", "Gender"), value: enumName(GENDER, filters.gender) },
    filters.religion && { label: t("ধর্ম", "Religion"), value: enumName(RELIGION, filters.religion) },
    filters.admitted_from && { label: t("ভর্তি (থেকে)", "Admitted from"), value: n(filters.admitted_from) },
    filters.admitted_to && { label: t("ভর্তি (পর্যন্ত)", "Admitted to"), value: n(filters.admitted_to) },
  ].filter(Boolean) as { label: string; value: string }[];

  const d = report.data;
  const findings = d
    ? enrolmentFindings({
        classes: d.by_class,
        total: d.total,
        boys: d.boys,
        girls: d.girls,
        dobMissing: d.dob_missing ?? 0,
        religionMissing: d.religion_missing ?? 0,
      })
    : [];

  const pct = (part: number, whole: number) => (whole > 0 ? ((part / whole) * 100).toFixed(1) : "0.0");

  return (
    <ReportShell
      title={t("ভর্তি ও জনমিতি", "Enrolment & Demographics")}
      subtitle={t(
        "শ্রেণি, লিঙ্গ, ধর্ম ও বয়স অনুযায়ী ভর্তির বিন্যাস",
        "The shape of enrolment by class, gender, religion and age",
      )}
      findings={findings}
      provenance={{
        filters: appliedFilters,
        definitions: [
          {
            term: t("ভর্তিভুক্ত", "Enrolled"),
            meaning: t(
              "চলতি শিক্ষাবর্ষে সক্রিয় ভর্তি — স্থানান্তরিত বা ঝরে পড়া শিক্ষার্থী নয়",
              "An active enrolment in the current academic year — not transferred or dropped students",
            ),
          },
          {
            term: t("বয়স-ভিত্তিক শতকরা", "Age percentages"),
            meaning: t(
              "যাদের জন্মতারিখ রেকর্ড আছে কেবল তাদের ভিত্তিতে",
              "Computed over the students who have a recorded date of birth, not the whole roll",
            ),
          },
        ],
        fetchedAt: report.dataUpdatedAt || undefined,
      }}
      actions={
        <Button
          onClick={() => d && exportCsv(
            `enrolment-report-${localDay()}.csv`,
            reportRows(d),
            // The filters ride along, so the export log records how much of the
            // roll was taken and not merely that a report was exported (R-7).
            { kind: "reports.enrolment", params: { ...filters } },
          )}
          disabled={!d}
        >
          <Download size={16} /> {t("এক্সপোর্ট", "Export")}
        </Button>
      }
    >
      <ReportFilters
        value={filters as EnrolmentFilters}
        onChange={(patch) => setFilters(patch as Partial<typeof FILTER_DEFAULTS>)}
        onReset={() => setFilters(FILTER_DEFAULTS)}
      />

      {report.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : report.isError ? (
        <ErrorState title={t("রিপোর্ট লোড করা যায়নি", "Could not load report")} description={msg(report.error)} />
      ) : !d || d.total === 0 ? (
        /*
          Two different empty states. "No students yet" is a statement about the
          school; "no students match this filter" is a statement about the
          query, and offering to clear the filter is only sensible in the second
          case (audit B-8).
        */
        appliedFilters.length > 0 ? (
          <EmptyState
            icon={<Users size={22} />}
            title={t("এই ফিল্টারে কোনো শিক্ষার্থী নেই", "No students match these filters")}
            description={t("ফিল্টার পরিবর্তন করুন বা রিসেট করুন।", "Change or reset the filters above.")}
          />
        ) : (
          <EmptyState
            icon={<Users size={22} />}
            title={t("কোনো শিক্ষার্থী নেই", "No students yet")}
            description={t("শিক্ষার্থী ভর্তি করলে এখানে পরিসংখ্যান দেখা যাবে।", "Statistics appear here once students are enrolled.")}
          />
        )
      ) : (
        (() => {
          const maxClass = Math.max(1, ...d.by_class.map((c) => c.total));
          const religionEntries = RELIGION.map((r) => ({ label: isBn ? r.bn : r.en, value: d.by_religion[r.value] ?? 0 })).filter((r) => r.value > 0);
          const maxReligion = Math.max(1, ...religionEntries.map((r) => r.value));
          const ageEntries = AGE_ORDER.filter((k) => (d.by_age[k] ?? 0) > 0).map((k) => ({ label: t(AGE_LABELS[k][0], AGE_LABELS[k][1]), value: d.by_age[k] }));
          const maxAge = Math.max(1, ...ageEntries.map((a) => a.value));
          const ageKnown = d.age_known ?? d.total;
          const dobMissing = d.dob_missing ?? 0;
          const religionMissing = d.religion_missing ?? 0;
          const classReligion = d.by_class_religion ?? [];
          const religionCols = RELIGION.filter((r) => classReligion.some((c) => c[r.value as ReligionKey] > 0));
          const anyNotRecorded = classReligion.some((c) => c.not_recorded > 0);
          const KPIS = [
            { label: t("মোট শিক্ষার্থী", "Total Students"), value: d.total, grad: "grad-indigo" },
            { label: t("ছেলে", "Boys"), value: d.boys, sub: `${pct(d.boys, d.total)}%`, grad: "grad-emerald" },
            { label: t("মেয়ে", "Girls"), value: d.girls, sub: `${pct(d.girls, d.total)}%`, grad: "grad-sky" },
            { label: t("সক্রিয়", "Active"), value: d.status["active"] ?? 0, grad: "grad-amber" },
          ];

          return (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {KPIS.map((k) => (
                  <div key={k.label} className={cn("flex flex-col gap-3 rounded-2xl px-5 py-4.5 text-white shadow-e2", k.grad)}>
                    <p className="text-meta font-medium opacity-90">{k.label}</p>
                    <p className="text-3xl font-bold tnum">{n(k.value)}</p>
                    <div className="flex items-center gap-1.5 text-meta opacity-90">
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

              {classReligion.length > 0 && religionCols.length > 0 ? (
                <div className="flex flex-col gap-3">
                  <CardHead
                    title={t("শ্রেণিভিত্তিক ধর্মীয় বিন্যাস", "Religion by Class")}
                    subtitle={t("প্রতি শ্রেণিতে ধর্ম অনুযায়ী শিক্ষার্থী সংখ্যা", "Students by religion in each class")}
                  />
                  <Table minWidth={640}>
                    <THead>
                      <TR>
                        <TH>{t("শ্রেণি", "Class")}</TH>
                        {religionCols.map((r) => (
                          <TH key={r.value} className="w-22.5 text-right">{isBn ? r.bn : r.en}</TH>
                        ))}
                        {anyNotRecorded ? <TH className="w-28 text-right">{t("রেকর্ড নেই", "Not recorded")}</TH> : null}
                        <TH className="w-22.5 text-right">{t("মোট", "Total")}</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {classReligion.map((c) => (
                        <TR key={c.numeric_level}>
                          <TH scope="row" className="text-left text-sm font-semibold text-text-primary">{isBn ? c.name_bn : c.name_en}</TH>
                          {religionCols.map((r) => (
                            <TD key={r.value} className="text-right text-meta text-text-secondary tnum">{n(c[r.value as ReligionKey])}</TD>
                          ))}
                          {anyNotRecorded ? <TD className="text-right text-meta text-text-muted tnum">{n(c.not_recorded)}</TD> : null}
                          <TD className="text-right text-meta font-semibold text-text-primary tnum">{n(c.total)}</TD>
                        </TR>
                      ))}
                    </TBody>
                    <tfoot>
                      <tr className="border-t border-border-strong bg-sunken text-meta font-bold text-text-primary">
                        <th scope="row" className="px-5 py-3 text-left">{t("সর্বমোট", "Grand total")}</th>
                        {religionCols.map((r) => (
                          <td key={r.value} className="px-5 py-3 text-right tnum">
                            {n(classReligion.reduce((s, c) => s + c[r.value as ReligionKey], 0))}
                          </td>
                        ))}
                        {anyNotRecorded ? (
                          <td className="px-5 py-3 text-right tnum">{n(classReligion.reduce((s, c) => s + c.not_recorded, 0))}</td>
                        ) : null}
                        <td className="px-5 py-3 text-right tnum">{n(classReligion.reduce((s, c) => s + c.total, 0))}</td>
                      </tr>
                    </tfoot>
                  </Table>
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <BreakdownCard
                  title={t("ধর্মভিত্তিক বিন্যাস", "Religion Distribution")}
                  subtitle={t("শিক্ষার্থীদের ধর্ম অনুযায়ী সংখ্যা", "Students by religion")}
                  rows={religionEntries.map((r) => ({ label: r.label, value: r.value, right: `${n(r.value)} (${pct(r.value, d.total - religionMissing)}%)` }))}
                  maxValue={maxReligion}
                  missing={religionMissing}
                  missingLabel={t(
                    `${n(religionMissing)} জন শিক্ষার্থীর ধর্ম রেকর্ড করা হয়নি`,
                    `Religion not recorded for ${religionMissing} students`,
                  )}
                />
                <BreakdownCard
                  title={t("বয়সভিত্তিক বিন্যাস", "Age Distribution")}
                  subtitle={
                    dobMissing > 0
                      ? t(`${n(ageKnown)} জনের জন্মতারিখ অনুযায়ী`, `Based on the ${ageKnown} students with a recorded date of birth`)
                      : t("বয়স গোষ্ঠী অনুযায়ী শিক্ষার্থী সংখ্যা", "Students by age group")
                  }
                  rows={ageEntries.map((a) => ({ label: a.label, value: a.value, right: `${n(a.value)} (${pct(a.value, ageKnown)}%)` }))}
                  maxValue={maxAge}
                  missing={dobMissing}
                  missingLabel={t(
                    `${n(dobMissing)} জন শিক্ষার্থীর জন্মতারিখ রেকর্ড করা হয়নি`,
                    `Date of birth not recorded for ${dobMissing} students`,
                  )}
                />
              </div>
            </>
          );
        })()
      )}
    </ReportShell>
  );
}

/* ---------- export ---------- */

/**
 * Every figure the screen renders, as one long-format sheet (C-3).
 *
 * English keys and raw enum values deliberately: a CSV is opened in Excel and
 * pivoted, not read as prose, and a Bengali-labelled column that changes with
 * the UI locale cannot be joined against anything.
 */
function reportRows(d: EnrolmentReport) {
  const pctOf = (part: number, whole: number) => (whole > 0 ? ((part / whole) * 100).toFixed(1) : "");
  const rows: { Section: string; Item: string; Count: number; Percent: string }[] = [];

  rows.push({ Section: "Summary", Item: "Total students", Count: d.total, Percent: "" });
  rows.push({ Section: "Summary", Item: "Boys", Count: d.boys, Percent: pctOf(d.boys, d.total) });
  rows.push({ Section: "Summary", Item: "Girls", Count: d.girls, Percent: pctOf(d.girls, d.total) });

  for (const c of d.by_class) {
    rows.push({ Section: "Class", Item: c.name_en, Count: c.total, Percent: pctOf(c.total, d.total) });
    rows.push({ Section: "Class · boys", Item: c.name_en, Count: c.boys, Percent: pctOf(c.boys, c.total) });
    rows.push({ Section: "Class · girls", Item: c.name_en, Count: c.girls, Percent: pctOf(c.girls, c.total) });
    rows.push({ Section: "Class · sections", Item: c.name_en, Count: c.sections, Percent: "" });
  }
  for (const [k, v] of Object.entries(d.status)) {
    rows.push({ Section: "Status", Item: k, Count: v, Percent: pctOf(v, d.total) });
  }

  const religionKnown = d.total - (d.religion_missing ?? 0);
  for (const [k, v] of Object.entries(d.by_religion)) {
    rows.push({ Section: "Religion", Item: k, Count: v, Percent: pctOf(v, religionKnown) });
  }
  const ageKnown = d.age_known ?? d.total;
  for (const [k, v] of Object.entries(d.by_age)) {
    rows.push({ Section: "Age group", Item: k, Count: v, Percent: pctOf(v, ageKnown) });
  }
  for (const c of d.by_class_religion ?? []) {
    for (const k of ["islam", "hindu", "christian", "buddhist", "other", "not_recorded"] as const) {
      if (c[k] > 0) {
        rows.push({
          Section: `Religion · ${c.name_en}`,
          Item: k === "not_recorded" ? "Not recorded" : k,
          Count: c[k],
          Percent: pctOf(c[k], c.total),
        });
      }
    }
  }

  rows.push({ Section: "Data quality", Item: "Date of birth not recorded", Count: d.dob_missing ?? 0, Percent: pctOf(d.dob_missing ?? 0, d.total) });
  rows.push({ Section: "Data quality", Item: "Date of birth generated (test data)", Count: d.dob_synthetic ?? 0, Percent: pctOf(d.dob_synthetic ?? 0, d.total) });
  rows.push({ Section: "Data quality", Item: "Religion not recorded", Count: d.religion_missing ?? 0, Percent: pctOf(d.religion_missing ?? 0, d.total) });
  return rows;
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

function BreakdownCard({ title, subtitle, rows, maxValue, missing = 0, missingLabel }: {
  title: string;
  subtitle: string;
  rows: { label: string; value: number; right: string }[];
  maxValue: number;
  missing?: number;
  missingLabel?: string;
}) {
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
      {missing > 0 && missingLabel ? (
        <p className="flex items-start gap-2 rounded-lg bg-warning-bg px-3 py-2 text-meta text-warning-fg" role="status">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          {missingLabel}
        </p>
      ) : null}
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
