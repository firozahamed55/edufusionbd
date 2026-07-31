"use client";

import { Wallet } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import {
  Skeleton, EmptyState, ErrorState, PageHeader, Pagination, LiveRegion,
  Table, THead, TBody, TR, TD, TableEmpty, SortableTH, DataToolbar,
} from "@/shared/ui";
import { useDataScreen, applyClientList } from "@/shared/lib/useDataScreen";
import { exportCsv } from "@/shared/lib/exportCsv";
import { localDay } from "@/shared/lib/format";
import { useUnpaidByInstitute } from "../../logic/hooks";
import { useErrorMessage } from "@/shared/services/errors";

/**
 * Fee · Dues (by Institute) — class/section-wise dues summary.
 *
 * One row per class-section, so the set is bounded and `applyClientList` is the
 * right tool. Sorting by amount owed is the point of the screen and it could
 * not do it (SRA A-0.1); the totals row still describes the WHOLE institution,
 * not the visible page.
 */
export function UnpaidInstituteScreen() {
  const { t, n, isBn } = useT();
  const msg = useErrorMessage();
  const ds = useDataScreen();
  const q = useUnpaidByInstitute();
  const d = q.data;

  const { rows, total } = applyClientList(d?.rows ?? [], ds, {
    search: (r) => [r.cls_bn, r.cls_en, r.sec_name],
    sort: {
      cls: (r) => r.numeric_level,
      section: (r) => r.sec_name,
      students: (r) => r.total_students,
      dueStudents: (r) => r.due_students,
      due: (r) => r.due_amount,
    },
  });

  return (
    <div className="flex flex-col gap-5">
      <LiveRegion message={q.isLoading ? t("লোড হচ্ছে", "Loading dues") : t(`${n(total)} সারি`, `${total} rows`)} />

      <PageHeader
        crumbs={[{ label: t("ফি ও অর্থ", "Fees & Finance"), href: "/admin/fee/quick-collection-list" }, { label: t("বকেয়া তথ্য", "Dues") }]}
        title={t("বকেয়া তথ্য", "Dues")}
        subtitle={t("প্রতিষ্ঠান অনুযায়ী বকেয়ার সারসংক্ষেপ", "Institute-wide dues summary")}
      />

      <DataToolbar
        q={ds.q}
        onQChange={ds.setQ}
        placeholder={t("শ্রেণি বা শাখা খুঁজুন", "Search class or section")}
        searchLabel={t("শ্রেণি খুঁজুন", "Search classes")}
        isFiltered={ds.isFiltered}
        onReset={ds.reset}
        onExportAll={() =>
          d &&
          exportCsv(
            `dues-by-institute-${localDay()}.csv`,
            d.rows.map((r) => ({
              Class: r.cls_en,
              Section: r.sec_name ?? "",
              TotalStudents: r.total_students,
              DueStudents: r.due_students,
              DueAmount: r.due_amount,
            })),
          )
        }
        exportAllCount={d?.rows.length ?? 0}
      />

      {q.isError ? (
        <ErrorState title={t("সারসংক্ষেপ লোড করা যায়নি", "Could not load summary")} description={msg(q.error)} />
      ) : !q.isLoading && (!d || d.rows.length === 0) ? (
        <EmptyState icon={<Wallet size={22} />} title={t("কোনো বকেয়া তথ্য নেই", "No dues data")} />
      ) : (
        <>
          <Table minWidth={760}>
            <THead>
              <TR>
                <SortableTH sortKey="cls" sort={ds.sort} onSort={ds.setSort}>{t("শ্রেণি", "Class")}</SortableTH>
                <SortableTH sortKey="section" sort={ds.sort} onSort={ds.setSort}>{t("শাখা", "Section")}</SortableTH>
                <SortableTH sortKey="students" sort={ds.sort} onSort={ds.setSort} className="text-right">{t("মোট শিক্ষার্থী", "Total")}</SortableTH>
                <SortableTH sortKey="dueStudents" sort={ds.sort} onSort={ds.setSort} className="text-right">{t("বকেয়া শিক্ষার্থী", "Due students")}</SortableTH>
                <SortableTH sortKey="due" sort={ds.sort} onSort={ds.setSort} className="text-right">{t("মোট বকেয়া", "Total due")}</SortableTH>
              </TR>
            </THead>
            <TBody>
              {q.isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TR key={i}>{Array.from({ length: 5 }).map((__, j) => <TD key={j}><Skeleton className="h-5" /></TD>)}</TR>
                ))
              ) : rows.length === 0 ? (
                <TableEmpty colSpan={5} title={t("কোনো মিল পাওয়া যায়নি", "No matches")} />
              ) : (
                rows.map((r, i) => (
                  <TR key={`${r.numeric_level}-${r.sec_name}-${i}`}>
                    <TD className="text-sm font-semibold text-text-primary">{isBn ? r.cls_bn : r.cls_en}</TD>
                    <TD className="text-meta text-text-secondary">{r.sec_name ?? "—"}</TD>
                    <TD className="text-right text-meta text-text-secondary tnum">{n(r.total_students)}</TD>
                    <TD className="text-right text-meta font-semibold text-danger-fg tnum">{n(r.due_students)}</TD>
                    <TD className="text-right text-sm font-bold text-text-primary tnum">৳{n(r.due_amount)}</TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>

          {/* Institution-wide, from the RPC — never a sum of the visible page. */}
          {d ? (
            <div className="flex items-center gap-3 rounded-xl bg-primary px-5 py-3.5 text-text-on-primary">
              <span className="flex-1 text-sm font-semibold">{t("সর্বমোট (পুরো প্রতিষ্ঠান)", "Grand total (whole institution)")}</span>
              <span className="w-32 text-right text-sm font-bold tnum">{n(d.total_students)}</span>
              <span className="w-32 text-right text-sm font-bold tnum">{n(d.due_students)}</span>
              <span className="w-32 text-right text-sm font-bold tnum">৳{n(d.total_due)}</span>
            </div>
          ) : null}

          {total > ds.perPage ? (
            <Pagination
              label={t(
                `${n(ds.from)}–${n(ds.to(total))} দেখানো হচ্ছে · মোট ${n(total)} সারি`,
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
