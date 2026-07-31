"use client";

import Link from "next/link";
import { Percent, CheckCircle2, AlertTriangle, Hash, ShieldCheck } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import {
  Skeleton, EmptyState, ErrorState, PageHeader, Pagination, LiveRegion, DataToolbar,
  Table, THead, TBody, TR, TH, TD, TableEmpty, SortableTH,
} from "@/shared/ui";
import { useDataScreen, applyClientList } from "@/shared/lib/useDataScreen";
import { exportCsv } from "@/shared/lib/exportCsv";
import { localDay, dayOffset } from "@/shared/lib/format";
import { useClassSectionsLookup } from "@/shared/services/lookups/hooks";
import type { Option } from "@/shared/services/lookups/api";
import { useAttendanceSummary } from "../../logic/hooks";
import { SoftStat, SummaryFilterBar } from "../../components/parts";
import { useErrorMessage } from "@/shared/services/errors";

/**
 * Attendance · Analytics — status split, KPIs and the at-risk list.
 *
 * Two things were wrong here beyond the missing contract (SRA A-0.1 / A-4·9):
 *
 * - The screen defaulted to "All classes & sections" and **threw on load**. The
 *   RPC has always accepted a null section as institution-wide; the fetcher
 *   refused to send null. Fixed in `attendance/logic/api.ts`, where the guard
 *   was — not worked around here, because the Report screen shares that fetcher.
 * - The per-row SMS button was `disabled` unconditionally: an eighth dead
 *   control of the kind A-0.3 removed seven of. Chasing an absentee means
 *   opening the student, so the row now opens the student.
 */
export function AnalyticsScreen() {
  const { t, n, isBn } = useT();
  const msg = useErrorMessage();

  const ds = useDataScreen({
    filters: { sectionId: "", from: dayOffset(-30), to: localDay() },
  });
  const { sectionId, from, to } = ds.filters;

  const sections = useClassSectionsLookup();
  const q = useAttendanceSummary(sectionId || null, from, to, Boolean(from && to));
  const opt = (list?: Option[]) => (list ?? []).map((o) => ({ value: o.value, label: isBn ? o.label_bn : o.label_en }));
  const d = q.data;

  const SPLIT = d ? [
    { key: "present", bn: "উপস্থিত", en: "Present", color: "bg-success-fg", v: d.status_split.present },
    { key: "absent", bn: "অনুপস্থিত", en: "Absent", color: "bg-danger-fg", v: d.status_split.absent },
    { key: "late", bn: "দেরি", en: "Late", color: "bg-warning-fg", v: d.status_split.late },
    { key: "leave", bn: "ছুটি", en: "Leave", color: "bg-info-fg", v: d.status_split.leave },
    { key: "exam_absent", bn: "পরীক্ষায় অনুপস্থিত", en: "Exam absent", color: "bg-violet-600", v: d.status_split.exam_absent },
  ] : [];
  const splitTotal = SPLIT.reduce((s, x) => s + x.v, 0) || 1;

  const all = d?.at_risk ?? [];
  const { rows, total } = applyClientList(all, ds, {
    search: (r) => [r.name_bn, r.name_en, r.code, r.roll],
    sort: {
      code: (r) => r.code,
      name: (r) => (isBn ? r.name_bn : r.name_en),
      roll: (r) => r.roll,
      absent: (r) => r.absent,
      rate: (r) => r.rate,
    },
  });

  return (
    <div className="flex flex-col gap-5">
      <LiveRegion
        message={
          q.isLoading
            ? t("লোড হচ্ছে", "Loading analytics")
            : t(`${n(total)} জন ঝুঁকিপূর্ণ শিক্ষার্থী`, `${total} at-risk students`)
        }
      />

      <PageHeader
        crumbs={[{ label: t("একাডেমিক", "Academic") }, { label: t("উপস্থিতি বিশ্লেষণ", "Attendance Analytics") }]}
        title={t("উপস্থিতি বিশ্লেষণ", "Attendance Analytics")}
        subtitle={t("উপস্থিতির প্রবণতা ও ঝুঁকি বিশ্লেষণ", "Attendance trends & risk analysis")}
      />

      <SummaryFilterBar
        sectionId={sectionId}
        from={from}
        to={to}
        sectionOptions={[{ value: "", label: t("সকল শ্রেণি ও শাখা", "All classes & sections") }, ...opt(sections.data)]}
        sectionPlaceholder={t("সকল শ্রেণি ও শাখা", "All classes & sections")}
        onApply={(next) => ds.setFilters({ sectionId: next.sectionId, from: next.from, to: next.to })}
      />

      {q.isError ? (
        <ErrorState title={t("বিশ্লেষণ লোড করা যায়নি", "Could not load analytics")} description={msg(q.error)} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {q.isLoading || !d ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)
            ) : (
              <>
                <SoftStat tone="success" icon={Percent} value={`${n(d.avg_rate)}%`} label={t("গড় উপস্থিতির হার", "Average rate")} />
                <SoftStat tone="primary" icon={CheckCircle2} value={n(d.regular_count)} label={t("নিয়মিত (≥৯০%)", "Regular (≥90%)")} />
                <SoftStat tone="danger" icon={AlertTriangle} value={n(d.at_risk_count)} label={t("ঝুঁকিপূর্ণ (<৭৫%)", "At risk (<75%)")} />
                <SoftStat tone="info" icon={Hash} value={n(d.working_days)} label={t("কার্যদিবস", "Working days")} />
              </>
            )}
          </div>

          {d ? (
            <div className="flex flex-col gap-2 rounded-2xl bg-surface p-5 shadow-e1">
              <p className="text-base font-semibold text-text-primary">{t("স্ট্যাটাস বিভাজন", "Status split")}</p>
              <div className="mt-1 flex h-3 overflow-hidden rounded-full bg-sunken">
                {SPLIT.map((s) => s.v > 0 ? <div key={s.key} className={s.color} style={{ width: `${(s.v / splitTotal) * 100}%` }} /> : null)}
              </div>
              <div className="mt-2 flex flex-col gap-2.5">
                {SPLIT.map((s) => (
                  <div key={s.key} className="flex items-center gap-2 text-meta">
                    <span className={cn("size-2.5 rounded-full", s.color)} />
                    <span className="flex-1 text-text-secondary">{t(s.bn, s.en)}</span>
                    <span className="font-semibold text-text-primary tnum">{n(Math.round((s.v / splitTotal) * 100))}%</span>
                    <span className="w-16 text-right text-text-muted tnum">{n(s.v)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold text-text-primary">{t("ঝুঁকিপূর্ণ শিক্ষার্থী", "At-risk students")}</p>
            <span className="rounded-full bg-danger-bg px-2.5 py-1 text-micro font-semibold text-danger-fg">
              {t("<৭৫% উপস্থিতি", "<75% attendance")}
            </span>
          </div>

          <DataToolbar
            q={ds.q}
            onQChange={ds.setQ}
            placeholder={t("নাম, আইডি বা রোল খুঁজুন", "Search name, ID or roll")}
            searchLabel={t("ঝুঁকিপূর্ণ শিক্ষার্থী খুঁজুন", "Search at-risk students")}
            isFiltered={ds.isFiltered}
            onReset={ds.reset}
            onExportAll={() =>
              exportCsv(
                `at-risk-attendance-${from}-to-${to}.csv`,
                all.map((r) => ({
                  StudentId: r.code ?? "",
                  Roll: r.roll ?? "",
                  Name: r.name_en,
                  AbsentDays: r.absent,
                  Rate: r.rate,
                })),
              )
            }
            exportAllCount={all.length}
          />

          {!q.isLoading && all.length === 0 ? (
            <EmptyState icon={<ShieldCheck size={22} />} title={t("কোনো ঝুঁকিপূর্ণ শিক্ষার্থী নেই", "No at-risk students")} />
          ) : (
            <>
              <Table minWidth={780}>
                <THead>
                  <TR>
                    <SortableTH sortKey="code" sort={ds.sort} onSort={ds.setSort}>{t("আইডি", "ID")}</SortableTH>
                    <SortableTH sortKey="name" sort={ds.sort} onSort={ds.setSort}>{t("শিক্ষার্থী", "Student")}</SortableTH>
                    <SortableTH sortKey="roll" sort={ds.sort} onSort={ds.setSort}>{t("রোল", "Roll")}</SortableTH>
                    <SortableTH sortKey="absent" sort={ds.sort} onSort={ds.setSort} className="text-right">{t("অনুপস্থিত", "Absent")}</SortableTH>
                    <SortableTH sortKey="rate" sort={ds.sort} onSort={ds.setSort} className="text-right">{t("উপস্থিতির হার", "Rate")}</SortableTH>
                    <TH className="text-right">{t("অ্যাকশন", "Action")}</TH>
                  </TR>
                </THead>
                <TBody>
                  {q.isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TR key={i}>{Array.from({ length: 6 }).map((__, j) => <TD key={j}><Skeleton className="h-5" /></TD>)}</TR>
                    ))
                  ) : rows.length === 0 ? (
                    <TableEmpty colSpan={6} title={t("কোনো মিল পাওয়া যায়নি", "No matches")} />
                  ) : (
                    rows.map((r) => (
                      <TR key={r.student_id}>
                        <TD className="font-latin text-meta font-medium text-text-secondary tnum">{r.code ? n(r.code) : "—"}</TD>
                        <TD className="text-sm font-semibold">
                          <Link href={`/admin/student/profile?id=${r.student_id}`} className="text-primary hover:underline">
                            {isBn ? r.name_bn : r.name_en}
                          </Link>
                        </TD>
                        <TD className="text-meta text-text-secondary tnum">{r.roll != null ? n(r.roll) : "—"}</TD>
                        <TD className="text-right text-meta font-semibold text-danger-fg tnum">{n(r.absent)}</TD>
                        <TD className="text-right text-sm font-bold text-danger-fg tnum">{n(r.rate)}%</TD>
                        <TD className="text-right">
                          <Link
                            href={`/admin/student/profile?id=${r.student_id}`}
                            className="text-meta font-medium text-primary hover:underline"
                          >
                            {t("প্রোফাইল", "Open profile")}
                          </Link>
                        </TD>
                      </TR>
                    ))
                  )}
                </TBody>
              </Table>

              {total > ds.perPage ? (
                <Pagination
                  label={t(
                    `${n(ds.from)}–${n(ds.to(total))} দেখানো হচ্ছে · মোট ${n(total)} জন`,
                    `Showing ${ds.from}-${ds.to(total)} of ${total}`,
                  )}
                  pages={ds.pages(total)}
                  current={ds.page}
                  onPageChange={ds.setPage}
                />
              ) : null}
            </>
          )}
        </>
      )}
    </div>
  );
}
