"use client";

import { Wallet } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import {
  Field, Select, Skeleton, EmptyState, ErrorState, PageHeader, Pagination, LiveRegion,
  Table, THead, TBody, TR, TH, TD, TableEmpty, SortableTH, DataToolbar,
} from "@/shared/ui";
import { useDataScreen, applyClientList } from "@/shared/lib/useDataScreen";
import { exportCsv } from "@/shared/lib/exportCsv";
import { localDay } from "@/shared/lib/format";
import { useClassSectionsLookup } from "@/shared/services/lookups/hooks";
import type { Option } from "@/shared/services/lookups/api";
import { useUnpaidBySection } from "../../logic/hooks";
import { useErrorMessage } from "@/shared/services/errors";

/**
 * Fee · Dues (by Section) — live per-student outstanding dues.
 *
 * "Find who owes, sort by amount, act on them" is the loop this screen exists
 * for, and sorting by amount was the one thing it could not do (SRA A-0.1). Now
 * URL-addressable, sortable, searchable, paged and exportable, with the roster
 * as a real `<Table>` rather than nested flex `<div>`s (A-0.7).
 */
export function UnpaidSectionScreen() {
  const { t, n, isBn } = useT();
  const msg = useErrorMessage();

  const ds = useDataScreen({ filters: { sectionId: "" } });
  const { sectionId } = ds.filters;

  const sections = useClassSectionsLookup();
  const q = useUnpaidBySection(sectionId || null);
  const opt = (list?: Option[]) => (list ?? []).map((o) => ({ value: o.value, label: isBn ? o.label_bn : o.label_en }));

  const all = q.data ?? [];
  // The grand total is of the WHOLE section, not the visible page — a footer
  // that silently sums one page is the defect this module has been bitten by
  // before (see the client-side-filter note in fee/logic/api.ts).
  const grandTotal = all.reduce((s, r) => s + r.due, 0);

  const { rows, total } = applyClientList(all, ds, {
    search: (r) => [r.name_bn, r.name_en, r.code, r.roll, r.detail],
    sort: {
      due: (r) => r.due,
      roll: (r) => r.roll,
      name: (r) => (isBn ? r.name_bn : r.name_en),
      code: (r) => r.code,
    },
  });

  return (
    <div className="flex flex-col gap-5">
      <LiveRegion
        message={
          !sectionId
            ? ""
            : q.isLoading
              ? t("লোড হচ্ছে", "Loading dues")
              : t(`${n(total)} জনের বকেয়া পাওয়া গেছে`, `${total} students with dues`)
        }
      />

      <PageHeader
        crumbs={[{ label: t("ফি ও অর্থ", "Fees & Finance"), href: "/admin/fee/quick-collection-list" }, { label: t("বকেয়া তথ্য", "Dues") }]}
        title={t("বকেয়া তথ্য", "Dues")}
        subtitle={t("সেকশন অনুযায়ী বকেয়া শিক্ষার্থী তালিকা", "Section-wise unpaid students")}
      />

      <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-surface p-5 shadow-e1">
        <Field label={t("শ্রেণি ও শাখা", "Class & Section")} required className="w-75 max-w-full">
          <Select
            value={sectionId}
            placeholder={sections.isLoading ? t("লোড হচ্ছে…", "Loading…") : t("নির্বাচন করুন", "Select")}
            options={opt(sections.data)}
            onChange={(e) => ds.setFilter("sectionId", e.target.value)}
          />
        </Field>
      </div>

      {sectionId ? (
        <DataToolbar
          q={ds.q}
          onQChange={ds.setQ}
          placeholder={t("নাম, আইডি বা রোল খুঁজুন", "Search name, ID or roll")}
          searchLabel={t("বকেয়া শিক্ষার্থী খুঁজুন", "Search students with dues")}
          isFiltered={ds.isFiltered}
          onReset={ds.reset}
          onExportAll={() =>
            exportCsv(
              `dues-by-section-${localDay()}.csv`,
              all.map((r) => ({
                StudentId: r.code ?? "",
                Roll: r.roll ?? "",
                Name: r.name_en,
                Detail: r.detail ?? "",
                Due: r.due,
              })),
            )
          }
          exportAllCount={all.length}
        />
      ) : null}

      {!sectionId ? (
        <EmptyState icon={<Wallet size={22} />} title={t("একটি শাখা নির্বাচন করুন", "Select a section")} />
      ) : q.isError ? (
        <ErrorState title={t("তালিকা লোড করা যায়নি", "Could not load list")} description={msg(q.error)} />
      ) : !q.isLoading && all.length === 0 ? (
        <EmptyState icon={<Wallet size={22} />} title={t("এই শাখায় কোনো বকেয়া নেই", "No dues in this section")} />
      ) : (
        <>
          <Table minWidth={800}>
            <THead>
              <TR>
                <SortableTH sortKey="code" sort={ds.sort} onSort={ds.setSort}>{t("শিক্ষার্থী আইডি", "Student ID")}</SortableTH>
                <SortableTH sortKey="roll" sort={ds.sort} onSort={ds.setSort}>{t("রোল", "Roll")}</SortableTH>
                <SortableTH sortKey="name" sort={ds.sort} onSort={ds.setSort}>{t("নাম", "Name")}</SortableTH>
                <TH>{t("বকেয়ার বিবরণ", "Dues detail")}</TH>
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
                rows.map((r) => (
                  <TR key={r.studentId}>
                    <TD className="font-latin text-meta font-medium text-text-secondary tnum">{r.code ? n(r.code) : "—"}</TD>
                    <TD className="text-meta text-text-secondary tnum">{r.roll != null ? n(r.roll) : "—"}</TD>
                    <TD className="text-sm font-medium text-text-primary">{isBn ? r.name_bn : r.name_en}</TD>
                    <TD className="text-meta leading-relaxed text-text-muted">{r.detail || "—"}</TD>
                    <TD className="text-right text-sm font-bold text-text-primary tnum">৳{n(r.due)}</TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>

          <div className="flex items-center gap-3 rounded-xl border border-border-strong bg-primary-subtle px-5 py-3.5 text-sm font-bold text-primary">
            <span className="flex-1">{t("সর্বমোট (পুরো শাখা)", "Grand total (whole section)")}</span>
            <span className="tnum">৳{n(grandTotal)}</span>
          </div>

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
