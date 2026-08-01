"use client";

import Link from "next/link";
import { Percent, CheckCircle2, AlertTriangle, Hash, Users } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import {
  Skeleton, EmptyState, ErrorState, PageHeader, Pagination, LiveRegion, DataToolbar,
  Table, THead, TBody, TR, TD, TableEmpty, SortableTH,
} from "@/shared/ui";
import { useDataScreen, applyClientList } from "@/shared/lib/useDataScreen";
import { exportCsv } from "@/shared/lib/exportCsv";
import { localDay, dayOffset } from "@/shared/lib/format";
import { useClassSectionsLookup } from "@/shared/services/lookups/hooks";
import type { Option } from "@/shared/services/lookups/api";
import { useAttendanceSummary } from "../../logic/hooks";
import { SoftStat, SummaryFilterBar } from "../../components/parts";
import { useErrorMessage } from "@/shared/services/errors";

const rateTone = (r: number) => (r >= 90 ? "text-success-fg" : r >= 75 ? "text-warning-fg" : "text-danger-fg");

/**
 * Attendance · Report — per-student attendance over a date range.
 *
 * On the data-interaction contract (SRA A-0.1 and A-4 item 9, which named this
 * screen for having no export, no pagination, no URL state and no per-student
 * drill-down). Section and range live in the URL, so "9-A, this month" is a
 * link the head teacher can be sent rather than four controls to describe.
 *
 * Client-paged: `fn_attendance_summary` returns the whole roster in one call
 * and there is no per-page variant to ask for. The set is bounded by the
 * section — and by the institution at its largest — so "export all" here really
 * is all of it.
 */
export function ReportScreen() {
  const { t, n, isBn } = useT();
  const msg = useErrorMessage();

  const ds = useDataScreen({
    filters: { sectionId: "", from: dayOffset(-30), to: localDay() },
  });
  const { sectionId, from, to } = ds.filters;

  const sections = useClassSectionsLookup();
  const q = useAttendanceSummary(sectionId || null, from, to, Boolean(sectionId));
  const opt = (list?: Option[]) => (list ?? []).map((o) => ({ value: o.value, label: isBn ? o.label_bn : o.label_en }));
  const d = q.data;

  const all = d?.students ?? [];
  const { rows, total } = applyClientList(all, ds, {
    search: (r) => [r.name_bn, r.name_en, r.code, r.roll],
    sort: {
      roll: (r) => r.roll,
      code: (r) => r.code,
      name: (r) => (isBn ? r.name_bn : r.name_en),
      present: (r) => r.present,
      rate: (r) => r.rate,
    },
  });

  return (
    <div className="flex flex-col gap-5">
      <LiveRegion
        message={
          !sectionId
            ? ""
            : q.isLoading
              ? t("লোড হচ্ছে", "Loading report")
              : t(`${n(total)} জন শিক্ষার্থী দেখানো হচ্ছে`, `${total} students shown`)
        }
      />

      <PageHeader
        crumbs={[{ label: t("একাডেমিক", "Academic") }, { label: t("উপস্থিতি রিপোর্ট", "Attendance Report") }]}
        title={t("উপস্থিতি রিপোর্ট", "Attendance Report")}
        subtitle={t("শ্রেণি ও তারিখ অনুযায়ী উপস্থিতির সারসংক্ষেপ", "Attendance summary by class and date range")}
      />

      <SummaryFilterBar
        sectionId={sectionId}
        from={from}
        to={to}
        sectionRequired
        sectionOptions={opt(sections.data)}
        sectionPlaceholder={sections.isLoading ? t("লোড হচ্ছে…", "Loading…") : t("নির্বাচন করুন", "Select")}
        onApply={(next) => ds.setFilters({ sectionId: next.sectionId, from: next.from, to: next.to })}
      />

      {!sectionId ? (
        <EmptyState icon={<Users size={22} />} title={t("একটি শ্রেণি নির্বাচন করে অনুসন্ধান করুন", "Select a class and search")} />
      ) : q.isError ? (
        <ErrorState title={t("রিপোর্ট লোড করা যায়নি", "Could not load report")} description={msg(q.error)} />
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
                <SoftStat tone="info" icon={Hash} value={n(d.working_days)} label={t("মোট কার্যদিবস", "Working days")} />
              </>
            )}
          </div>

          <DataToolbar
            q={ds.q}
            onQChange={ds.setQ}
            placeholder={t("নাম, আইডি বা রোল খুঁজুন", "Search name, ID or roll")}
            searchLabel={t("শিক্ষার্থী খুঁজুন", "Search students")}
            isFiltered={ds.isFiltered}
            onReset={ds.reset}
            onExportAll={() =>
              exportCsv(
                `attendance-report-${from}-to-${to}.csv`,
                all.map((r) => ({
                  StudentId: r.code ?? "",
                  Roll: r.roll ?? "",
                  Name: r.name_en,
                  Present: r.present,
                  WorkingDays: r.total,
                  Rate: r.rate,
                })),
                { kind: "attendance.report", params: { from, to } },
              )
            }
            exportAllCount={all.length}
          />

          <Table minWidth={820}>
            <THead>
              <TR>
                <SortableTH sortKey="code" sort={ds.sort} onSort={ds.setSort}>{t("আইডি", "ID")}</SortableTH>
                <SortableTH sortKey="roll" sort={ds.sort} onSort={ds.setSort}>{t("রোল", "Roll")}</SortableTH>
                <SortableTH sortKey="name" sort={ds.sort} onSort={ds.setSort}>{t("নাম", "Name")}</SortableTH>
                <SortableTH sortKey="present" sort={ds.sort} onSort={ds.setSort}>{t("উপস্থিতি / কার্যদিবস", "Present / days")}</SortableTH>
                <SortableTH sortKey="rate" sort={ds.sort} onSort={ds.setSort} className="text-right">{t("উপস্থিতির হার", "Rate")}</SortableTH>
              </TR>
            </THead>
            <TBody>
              {q.isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TR key={i}>{Array.from({ length: 5 }).map((__, j) => <TD key={j}><Skeleton className="h-5" /></TD>)}</TR>
                ))
              ) : rows.length === 0 ? (
                <TableEmpty
                  colSpan={5}
                  icon={<Users size={22} />}
                  title={t("এই সময়ে কোনো উপস্থিতি রেকর্ড নেই", "No attendance records in this range")}
                />
              ) : (
                rows.map((r) => (
                  <TR key={r.student_id}>
                    <TD className="font-latin text-meta font-medium text-text-secondary tnum">{r.code ? n(r.code) : "—"}</TD>
                    <TD className="text-meta text-text-secondary tnum">{r.roll != null ? n(r.roll) : "—"}</TD>
                    <TD className="text-sm font-medium">
                      {/* The drill-down A-4 item 9 asks for. `student_id` is new
                          in the summary payload — the roster used to carry only
                          a display code and could not be linked out of. */}
                      <Link href={`/admin/student/profile?id=${r.student_id}`} className="text-primary hover:underline">
                        {isBn ? r.name_bn : r.name_en}
                      </Link>
                    </TD>
                    <TD className="text-meta text-text-secondary tnum">{n(r.present)} / {n(r.total)}</TD>
                    <TD className={cn("text-right text-sm font-bold tnum", rateTone(r.rate))}>{n(r.rate)}%</TD>
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
    </div>
  );
}
