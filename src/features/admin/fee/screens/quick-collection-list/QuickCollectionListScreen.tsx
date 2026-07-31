"use client";

import Link from "next/link";
import { ShoppingCart, Users } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import {
  Field, Select, Skeleton, EmptyState, ErrorState, PageHeader, Pagination, LiveRegion,
  Table, THead, TBody, TR, TH, TD, TableEmpty, SortableTH, Badge, DataToolbar,
} from "@/shared/ui";
import { useDataScreen, applyClientList } from "@/shared/lib/useDataScreen";
import { exportCsv } from "@/shared/lib/exportCsv";
import { localDay } from "@/shared/lib/format";
import { useClassSectionsLookup } from "@/shared/services/lookups/hooks";
import { useSectionStudents } from "@/shared/services/roster/hooks";
import type { Option } from "@/shared/services/lookups/api";
import { useErrorMessage } from "@/shared/services/errors";

/**
 * Fee · Quick Collection (list) — pick a section, choose a student to collect.
 *
 * Carried none of the data-interaction contract (SRA A-0.1) and rendered its
 * roster as nested flex `<div>`s with no `role="table"`, so a screen reader
 * announced an undifferentiated wall of text (A-0.7). Both fixed here: the
 * section lives in the URL so a collector can bookmark their counter's section,
 * and the roster is a real `<Table>`.
 */
export function QuickCollectionListScreen() {
  const { t, n, isBn } = useT();
  const msg = useErrorMessage();

  const ds = useDataScreen({ filters: { sectionId: "" } });
  const { sectionId } = ds.filters;

  const sections = useClassSectionsLookup();
  const students = useSectionStudents(sectionId || null);
  const opt = (list?: Option[]) => (list ?? []).map((o) => ({ value: o.value, label: isBn ? o.label_bn : o.label_en }));

  // One section's roster is bounded (~60), so search/sort/page happen here
  // rather than as a round trip per keystroke.
  const { rows, total } = applyClientList(students.data ?? [], ds, {
    search: (r) => [r.name_bn, r.name_en, r.code, r.roll],
    sort: {
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
            : students.isLoading
              ? t("লোড হচ্ছে", "Loading students")
              : t(`${n(total)} জন শিক্ষার্থী পাওয়া গেছে`, `${total} students found`)
        }
      />

      <PageHeader
        crumbs={[{ label: t("ফি ও অর্থ", "Fees & Finance"), href: "/admin/fee/quick-collection-list" }, { label: t("কুইক কালেকশন", "Quick Collection") }]}
        title={t("কুইক কালেকশন", "Quick Collection")}
        subtitle={t("শাখা বেছে নিয়ে শিক্ষার্থীর ফি আদায় করুন", "Pick a section and collect a student's fees")}
      />

      <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-surface p-5 shadow-e1">
        <Field label={t("শাখা", "Section")} required className="w-90 max-w-full">
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
          searchLabel={t("শিক্ষার্থী খুঁজুন", "Search students")}
          isFiltered={ds.isFiltered}
          onReset={ds.reset}
          onExportPage={() =>
            exportCsv(
              `collection-roster-${localDay()}.csv`,
              rows.map((r) => ({ StudentID: r.code ?? "", Roll: r.roll ?? "", Name: r.name_en, Category: r.category ?? "" })),
            )
          }
          exportPageCount={rows.length}
        />
      ) : null}

      {!sectionId ? (
        <EmptyState icon={<Users size={22} />} title={t("একটি শাখা নির্বাচন করুন", "Select a section")} description={t("ফি আদায়ের জন্য শিক্ষার্থী তালিকা লোড করুন।", "Load the student list to collect fees.")} />
      ) : students.isError ? (
        <ErrorState title={t("তালিকা লোড করা যায়নি", "Could not load list")} description={msg(students.error)} />
      ) : (
        <>
          <Table minWidth={640}>
            <THead>
              <TR>
                <SortableTH sortKey="code" sort={ds.sort} onSort={ds.setSort}>{t("শিক্ষার্থী আইডি", "Student ID")}</SortableTH>
                <SortableTH sortKey="roll" sort={ds.sort} onSort={ds.setSort}>{t("রোল", "Roll")}</SortableTH>
                <SortableTH sortKey="name" sort={ds.sort} onSort={ds.setSort}>{t("নাম", "Name")}</SortableTH>
                <TH>{t("ক্যাটাগরি", "Category")}</TH>
                <TH className="w-20 text-right">{t("অ্যাকশন", "Action")}</TH>
              </TR>
            </THead>
            <TBody>
              {students.isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TR key={i}>{Array.from({ length: 5 }).map((__, j) => <TD key={j}><Skeleton className="h-5" /></TD>)}</TR>
                ))
              ) : rows.length === 0 ? (
                <TableEmpty
                  colSpan={5}
                  title={ds.isFiltered ? t("কোনো মিল পাওয়া যায়নি", "No matches") : t("এই শাখায় কোনো শিক্ষার্থী নেই", "No students in this section")}
                />
              ) : (
                rows.map((r) => (
                  <TR key={r.enrollmentId}>
                    <TD className="font-latin text-meta font-medium text-text-secondary tnum">{r.code ? n(r.code) : "—"}</TD>
                    <TD className="text-meta text-text-secondary tnum">{r.roll != null ? n(r.roll) : "—"}</TD>
                    <TD className="text-sm font-medium text-text-primary">{isBn ? r.name_bn : r.name_en}</TD>
                    <TD><Badge tone="primary">{r.category ?? t("সাধারণ", "General")}</Badge></TD>
                    <TD className="text-right">
                      <Link
                        href={`/admin/fee/quick-collection-form?student=${r.studentId}`}
                        aria-label={t(`${r.name_bn} এর ফি আদায়`, `Collect fees for ${r.name_en}`)}
                        className="inline-grid size-8 place-items-center rounded-lg bg-primary text-text-on-primary hover:bg-primary-hover"
                      >
                        <ShoppingCart size={15} />
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
    </div>
  );
}
