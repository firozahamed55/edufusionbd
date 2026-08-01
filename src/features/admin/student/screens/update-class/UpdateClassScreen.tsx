"use client";

import Link from "next/link";
import { Pencil, Users } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import {
  Field, Select, Skeleton, EmptyState, ErrorState, PageHeader, Pagination, LiveRegion,
  Table, THead, TBody, TR, TH, TD, TableEmpty, SortableTH, DataToolbar, Button,
} from "@/shared/ui";
import { useDataScreen, applyClientList } from "@/shared/lib/useDataScreen";
import { exportCsv } from "@/shared/lib/exportCsv";
import { localDay, formatDate } from "@/shared/lib/format";
import { useClassSections, useStudentsBySection } from "./logic/useUpdateClass";

/**
 * Student · Class List — pick a class-section, see its roster.
 *
 * Was the emptiest screen in the capability matrix (SRA A-2.2): **zero**
 * loading/empty/error states from `shared/ui`, no pagination, no export, no
 * sort, no URL state, and a roster rendered as nested flex `<div>`s with no
 * `role="table"` (A-0.7). It also shipped a **row Edit button with no
 * `onClick`** — an eighth dead control, not in the report's list of seven,
 * found while migrating this screen. It now links to that student's record.
 */
export function UpdateClassScreen() {
  const { t, n, isBn } = useT();

  const ds = useDataScreen({ filters: { section: "" } });
  const { section } = ds.filters;

  const { data: sections = [] } = useClassSections();
  const { data: students = [], isLoading, isError, refetch } = useStudentsBySection(section || null);

  const sectionOptions = sections.map((s) => ({ value: s.value, label: isBn ? s.label_bn : s.label_en }));

  // A section's roster is bounded (~60) — search/sort/page here, not per keystroke.
  const { rows, total } = applyClientList(students, ds, {
    search: (r) => [r.name_bn, r.name_en, r.code, r.roll, r.father, r.phone],
    sort: {
      roll: (r) => r.roll,
      name: (r) => (isBn ? r.name_bn : r.name_en),
      code: (r) => r.code,
      dob: (r) => r.dob,
    },
  });

  return (
    <div className="flex flex-col gap-5">
      <LiveRegion
        message={
          !section
            ? ""
            : isLoading
              ? t("লোড হচ্ছে", "Loading students")
              : t(`${n(total)} জন শিক্ষার্থী পাওয়া গেছে`, `${total} students found`)
        }
      />

      <PageHeader
        crumbs={[{ label: t("শিক্ষার্থী", "Students"), href: "/admin/student/registration" }, { label: t("শ্রেণি তালিকা", "Class List") }]}
        title={t("শ্রেণি তথ্য হালনাগাদ", "Update Class Info")}
        subtitle={t("শ্রেণি নির্বাচন করে শিক্ষার্থী তালিকা দেখুন", "Select a class-section to view its students")}
      />

      <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-surface p-5 shadow-e1">
        <Field label={t("শ্রেণি ও শাখা", "Class & Section")} required className="w-90 max-w-full">
          <Select
            value={section}
            onChange={(e) => ds.setFilter("section", e.target.value)}
            options={sectionOptions}
            placeholder={t("শ্রেণি নির্বাচন করুন", "Select class-section")}
          />
        </Field>
        {/* No Search button: the roster loads reactively from the select. */}
      </div>

      {section ? (
        <DataToolbar
          q={ds.q}
          onQChange={ds.setQ}
          placeholder={t("নাম, আইডি বা ফোন খুঁজুন", "Search name, ID or phone")}
          searchLabel={t("শিক্ষার্থী খুঁজুন", "Search students")}
          isFiltered={ds.isFiltered}
          onReset={ds.reset}
          onExportPage={() =>
            exportCsv(
              `class-roster-${localDay()}.csv`,
              rows.map((r) => ({
                StudentID: r.code ?? "",
                Roll: r.roll ?? "",
                Name: r.name_en,
                Father: r.father ?? "",
                DOB: r.dob ?? "",
                GuardianPhone: r.phone ?? "",
              })),
              { kind: "student.update_class", params: { sectionId: section || null, q: ds.debouncedQ, scope: "page" } },
            )
          }
          exportPageCount={rows.length}
        />
      ) : null}

      {!section ? (
        <EmptyState
          icon={<Users size={22} />}
          title={t("একটি শ্রেণি নির্বাচন করুন", "Select a class-section")}
          description={t("তালিকা দেখতে উপরে থেকে শ্রেণি বেছে নিন।", "Pick a class-section above to see the list.")}
        />
      ) : isError ? (
        <ErrorState
          title={t("তালিকা লোড করা যায়নি", "Couldn't load the list")}
          action={<Button onClick={() => refetch()}>{t("পুনরায় চেষ্টা", "Retry")}</Button>}
        />
      ) : (
        <>
          <Table minWidth={880}>
            <THead>
              <TR>
                <SortableTH sortKey="code" sort={ds.sort} onSort={ds.setSort}>{t("শিক্ষার্থী আইডি", "Student ID")}</SortableTH>
                <SortableTH sortKey="roll" sort={ds.sort} onSort={ds.setSort}>{t("রোল", "Roll")}</SortableTH>
                <SortableTH sortKey="name" sort={ds.sort} onSort={ds.setSort}>{t("নাম", "Name")}</SortableTH>
                <TH>{t("পিতার নাম", "Father's Name")}</TH>
                <SortableTH sortKey="dob" sort={ds.sort} onSort={ds.setSort}>{t("জন্ম তারিখ", "Date of Birth")}</SortableTH>
                <TH>{t("অভিভাবকের ফোন নম্বর", "Guardian Phone")}</TH>
                <TH className="w-20 text-right">{t("অ্যাকশন", "Action")}</TH>
              </TR>
            </THead>
            <TBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TR key={i}>{Array.from({ length: 7 }).map((__, j) => <TD key={j}><Skeleton className="h-5" /></TD>)}</TR>
                ))
              ) : rows.length === 0 ? (
                <TableEmpty
                  colSpan={7}
                  title={ds.isFiltered ? t("কোনো মিল পাওয়া যায়নি", "No matches") : t("এই শ্রেণিতে কোনো শিক্ষার্থী নেই", "No students in this class-section")}
                />
              ) : (
                rows.map((r) => (
                  <TR key={r.enrollmentId}>
                    <TD className="font-latin text-meta font-medium text-text-secondary tnum">{r.code ?? "—"}</TD>
                    <TD className="text-meta text-text-secondary tnum">{r.roll != null ? n(r.roll) : "—"}</TD>
                    <TD className="text-sm font-medium">
                      <Link href={`/admin/student/profile?id=${r.studentId}`} className="text-primary hover:underline">
                        {isBn ? r.name_bn : r.name_en}
                      </Link>
                    </TD>
                    <TD className="text-meta text-text-secondary">{r.father ?? "—"}</TD>
                    <TD className="text-meta text-text-secondary tnum">{r.dob ? n(formatDate(r.dob)) : "—"}</TD>
                    <TD className="font-latin text-meta text-text-secondary">{r.phone ? n(r.phone) : "—"}</TD>
                    <TD className="text-right">
                      {/* Was a <button> with no onClick at all. */}
                      <Link
                        href={`/admin/student/update-basic?section=${section}`}
                        aria-label={t(`${r.name_bn} এর তথ্য সম্পাদনা`, `Edit ${r.name_en}`)}
                        className="inline-grid size-8 place-items-center rounded-lg bg-primary text-text-on-primary hover:bg-primary-hover"
                      >
                        <Pencil size={15} />
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
