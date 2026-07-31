"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserPlus, Pencil, Send } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import {
  Table, THead, TBody, TR, TH, TD, TableEmpty, Badge, ErrorState, Pagination,
  SortableTH, RowActions, Checkbox, Button, PageHeader, LiveRegion,
  DataToolbar, BulkBar, BulkAction,
} from "@/shared/ui";
import { useDataScreen } from "@/shared/lib/useDataScreen";
import { exportCsv } from "@/shared/lib/exportCsv";
import { localDay } from "@/shared/lib/format";
import { useDepartments } from "@/shared/services/lookups/hooks";
import { useTeachers } from "./logic/useTeachers";
import { fetchTeachers } from "./logic/api";
import { createClient } from "@/shared/services/supabase/client";
import { MAX_OPTIONS } from "@/shared/services/supabase/paging";

/**
 * Teacher list — LIVE from Supabase (teacher + designation + main subject +
 * class-teacher flag), RLS-scoped to the caller's institution.
 *
 * Was the hand-rolled reference implementation of the data-interaction layer.
 * That layer now lives in `useDataScreen` + `DataToolbar` (SRA A-0.1) and this
 * screen is its first consumer — migrated first precisely so the extraction is
 * proven against the one screen whose behaviour was already correct, rather
 * than validated only on the thirteen that had none of it.
 *
 * Search / filter / sort / page still live in the URL, so this view is
 * bookmarkable, shareable, survives refresh and the back button, and can hand
 * its selection to another screen.
 */
export function ListScreen() {
  const { t, isBn, n } = useT();
  const router = useRouter();

  const ds = useDataScreen({ filters: { departmentId: "" } });
  const { page, sort, debouncedQ } = ds;
  const { departmentId } = ds.filters;

  const [exportingAll, setExportingAll] = useState(false);

  const { data, isLoading, isError, refetch } = useTeachers(page, debouncedQ, departmentId, sort);
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const selection = ds.useSelection(rows.map((r) => r.id));
  // Server-side distinct list — not derived from `rows`, which only ever holds
  // the current page and silently shrinks the filter as you page (audit W-3).
  const { data: departments = [] } = useDepartments();

  const toCsvRow = (r: (typeof rows)[number]) => ({
    Name: r.name_en,
    Email: r.email ?? "",
    Designation: r.designation ?? "",
    Department: r.department ?? "",
    Status: r.status,
  });

  const exportAll = async () => {
    setExportingAll(true);
    try {
      const all = await fetchTeachers(createClient(), {
        page: 1,
        perPage: MAX_OPTIONS,
        search: debouncedQ,
        departmentId,
        sort,
      });
      exportCsv(`teachers-all-${localDay()}.csv`, all.rows.map(toCsvRow));
    } finally {
      setExportingAll(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Searching/filtering/sorting silently swaps the table contents; without
          this a screen-reader user gets no signal that anything happened. */}
      <LiveRegion
        message={
          isLoading
            ? t("লোড হচ্ছে", "Loading teachers")
            : t(`${n(total)} জন শিক্ষক পাওয়া গেছে`, `${total} teachers found`)
        }
      />
      <div className="flex flex-wrap items-start gap-3">
        <PageHeader
          className="flex-1"
          title={t("শিক্ষক তালিকা", "Teacher List")}
          subtitle={t("সকল শিক্ষক ও কর্মীর তথ্য, বিষয় ও স্ট্যাটাস", "All teachers & staff — subject and status")}
        />
        <Link
          href="/admin/teacher/registration"
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-text-on-primary hover:bg-primary-hover"
        >
          <UserPlus size={16} /> {t("নতুন শিক্ষক", "New Teacher")}
        </Link>
      </div>

      <DataToolbar
        q={ds.q}
        onQChange={ds.setQ}
        placeholder={t("নাম, আইডি বা মোবাইল খুঁজুন", "Search name, ID or mobile")}
        searchLabel={t("শিক্ষক খুঁজুন", "Search teachers")}
        filters={
          <select
            value={departmentId}
            onChange={(e) => ds.setFilter("departmentId", e.target.value)}
            aria-label={t("বিভাগ ফিল্টার", "Filter by department")}
            className="rounded-lg border border-border-control bg-surface px-3 py-2.5 text-meta font-medium text-text-secondary"
          >
            <option value="">{t("বিভাগ: সব", "Department: All")}</option>
            {departments.map((d) => (
              <option key={d.value} value={d.value}>{isBn ? d.label_bn : d.label_en}</option>
            ))}
          </select>
        }
        isFiltered={ds.isFiltered}
        onReset={ds.reset}
        onExportPage={() => exportCsv(`teachers-page${page}-${localDay()}.csv`, rows.map(toCsvRow))}
        exportPageCount={rows.length}
        onExportAll={exportAll}
        exportAllCount={total}
        exportingAll={exportingAll}
      />

      <BulkBar count={selection.count} onClear={selection.clear}>
        <BulkAction
          icon={<Send size={14} />}
          onClick={() => router.push(`/admin/sms-notice/send?recipients=${selection.asArray().join(",")}`)}
        >
          {t("এসএমএস পাঠান", "Send SMS")}
        </BulkAction>
      </BulkBar>

      {isError ? (
        <ErrorState
          title={t("শিক্ষক তালিকা লোড করা যায়নি", "Couldn't load teachers")}
          action={<Button onClick={() => refetch()}>{t("পুনরায় চেষ্টা", "Retry")}</Button>}
        />
      ) : (
        <Table minWidth={720}>
          <THead>
            <TR>
              <TH className="w-10">
                <Checkbox
                  checked={selection.allOnPage}
                  indeterminate={selection.someOnPage}
                  onChange={selection.toggleAll}
                  aria-label={t("সব নির্বাচন করুন", "Select all")}
                />
              </TH>
              <SortableTH
                sortKey="name"
                sort={sort}
                onSort={ds.setSort}
              >
                {t("শিক্ষক", "Teacher")}
              </SortableTH>
              <TH>{t("পদবি", "Designation")}</TH>
              <TH>{t("মূল বিষয়", "Main Subject")}</TH>
              <TH>{t("শ্রেণি শিক্ষক", "Class Teacher")}</TH>
              <SortableTH
                sortKey="status"
                sort={sort}
                onSort={ds.setSort}
              >
                {t("স্ট্যাটাস", "Status")}
              </SortableTH>
              <TH className="w-11">
                <span className="sr-only">{t("অ্যাকশন", "Actions")}</span>
              </TH>
            </TR>
          </THead>
          <TBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TR key={i}>
                  {Array.from({ length: 7 }).map((__, j) => (
                    <TD key={j}>
                      <span className="block h-5 animate-pulse rounded bg-sunken" />
                    </TD>
                  ))}
                </TR>
              ))
            ) : rows.length === 0 ? (
              <TableEmpty colSpan={7} title={t("কোনো শিক্ষক পাওয়া যায়নি", "No teachers found")} />
            ) : (
              rows.map((r) => {
                const name = isBn ? r.name_bn : r.name_en;
                return (
                  <TR key={r.id}>
                    <TD>
                      <Checkbox
                        checked={selection.has(r.id)}
                        onChange={() => selection.toggle(r.id)}
                        aria-label={t("নির্বাচন করুন", "Select row")}
                      />
                    </TD>
                    <TD>
                      <span className="flex items-center gap-2.5">
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-subtle text-sm font-semibold text-primary">
                          {name.trim().charAt(0)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-text-primary">{name}</span>
                          <span className="block truncate text-xs text-text-muted">{r.email ?? "—"}</span>
                        </span>
                      </span>
                    </TD>
                    <TD>
                      {r.designation ? <Badge tone="info">{r.designation}</Badge> : <span className="text-text-muted">—</span>}
                    </TD>
                    <TD className="text-meta font-medium text-text-secondary">
                      {r.subject_bn || r.subject_en ? t(r.subject_bn ?? "", r.subject_en ?? "") : "—"}
                    </TD>
                    <TD>
                      <Badge tone={r.classTeacher ? "success" : "warning"} dot>
                        {r.classTeacher ? t("হ্যাঁ", "Yes") : t("না", "No")}
                      </Badge>
                    </TD>
                    <TD>
                      <Badge tone={r.status === "active" ? "success" : "neutral"} dot>
                        {r.status === "active"
                          ? t("কর্মরত", "Active")
                          : r.status === "on_leave"
                            ? t("ছুটিতে", "On Leave")
                            : t("অব্যাহতি", "Separated")}
                      </Badge>
                    </TD>
                    <TD className="text-center">
                      <RowActions
                        label={t("অ্যাকশন", "Actions")}
                        actions={[
                          { label: t("প্রোফাইল সম্পাদনা", "Edit profile"), icon: Pencil, href: `/admin/teacher/update-profile?id=${r.id}` },
                          {
                            label: t("এসএমএস পাঠান", "Send SMS"),
                            icon: Send,
                            href: `/admin/sms-notice/send?recipients=${r.id}`,
                          },
                        ]}
                      />
                    </TD>
                  </TR>
                );
              })
            )}
          </TBody>
        </Table>
      )}

      {total > 0 ? (
        <Pagination
          label={t(
            `${n(ds.from)}–${n(ds.to(total))} দেখানো হচ্ছে · মোট ${n(total)} জন`,
            `Showing ${ds.from}-${ds.to(total)} of ${total}`,
          )}
          pages={ds.pages(total)}
          current={page}
          onPageChange={ds.setPage}
        />
      ) : null}
    </div>
  );
}
