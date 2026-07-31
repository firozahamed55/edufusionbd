"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserPlus, Search, Pencil, Download, Send } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import {
  Table, THead, TBody, TR, TH, TD, TableEmpty, Badge, ErrorState, Pagination,
  SortableTH, RowActions, Checkbox, Button, PageHeader, LiveRegion, type Sort,
} from "@/shared/ui";
import { useDebouncedValue } from "@/shared/lib/useDebouncedValue";
import { useQueryState } from "@/shared/lib/useQueryState";
import { exportCsv } from "@/shared/lib/exportCsv";
import { useDepartments } from "@/shared/services/lookups/hooks";
import { useTeachers } from "./logic/useTeachers";
import { fetchTeachers } from "./logic/api";
import { createClient } from "@/shared/services/supabase/client";
import { MAX_OPTIONS } from "@/shared/services/supabase/paging";

const PER_PAGE = 20;

/**
 * Teacher list — LIVE from Supabase (teacher + designation + main subject +
 * class-teacher flag), RLS-scoped to the caller's institution.
 *
 * The reference implementation of the §Phase-2 data-interaction layer: search /
 * filter / sort / page live in the URL (`useQueryState`), so this view is
 * bookmarkable, shareable, survives refresh and the back button, and can hand
 * its selection to another screen.
 */
export function ListScreen() {
  const { t, isBn, n } = useT();
  const router = useRouter();

  const [{ q, departmentId, page, sortKey, sortDir }, setQuery] = useQueryState({
    q: "",
    departmentId: "",
    page: 1,
    sortKey: "",
    sortDir: "",
  });
  const debouncedQ = useDebouncedValue(q, 300);
  const sort: Sort = sortKey ? { key: sortKey, dir: sortDir === "desc" ? "desc" : "asc" } : null;

  const [exportingAll, setExportingAll] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data, isLoading, isError, refetch } = useTeachers(page, debouncedQ, departmentId, sort);
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
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
      exportCsv(`teachers-all-${new Date().toISOString().slice(0, 10)}.csv`, all.rows.map(toCsvRow));
    } finally {
      setExportingAll(false);
    }
  };

  const toggleOne = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Page-aware (audit W-8): `selected` spans pages, so "all" means every row on
  // THIS page, not a count comparison that misreports once selections span pages.
  const pageIds = rows.map((r) => r.id);
  const selectedOnPage = pageIds.filter((id) => selected.has(id)).length;
  const allOnPage = pageIds.length > 0 && selectedOnPage === pageIds.length;
  const someOnPage = selectedOnPage > 0 && !allOnPage;
  const toggleAll = () =>
    setSelected((s) => {
      const next = new Set(s);
      if (allOnPage) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });

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

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border-control bg-surface px-3 py-2.5 sm:max-w-75 sm:flex-none">
          <Search size={16} className="text-text-muted" />
          <input
            value={q}
            onChange={(e) => setQuery({ q: e.target.value, page: 1 })}
            placeholder={t("নাম, আইডি বা মোবাইল খুঁজুন", "Search name, ID or mobile")}
            aria-label={t("শিক্ষক খুঁজুন", "Search teachers")}
            className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
          />
        </div>
        <div className="hidden flex-1 sm:block" />
        <select
          value={departmentId}
          onChange={(e) => setQuery({ departmentId: e.target.value, page: 1 })}
          aria-label={t("বিভাগ ফিল্টার", "Filter by department")}
          className="rounded-lg border border-border-control bg-surface px-3 py-2.5 text-meta font-medium text-text-secondary"
        >
          <option value="">{t("বিভাগ: সব", "Department: All")}</option>
          {departments.map((d) => (
            <option key={d.value} value={d.value}>{isBn ? d.label_bn : d.label_en}</option>
          ))}
        </select>
        <Button
          variant="secondary"
          onClick={() => exportCsv(`teachers-page${page}-${new Date().toISOString().slice(0, 10)}.csv`, rows.map(toCsvRow))}
          disabled={rows.length === 0}
        >
          <Download size={14} /> {t(`এই পাতা এক্সপোর্ট (${n(rows.length)})`, `Export this page (${rows.length})`)}
        </Button>
        <Button variant="secondary" onClick={exportAll} disabled={total === 0} loading={exportingAll}>
          {!exportingAll ? <Download size={14} /> : null}
          {exportingAll ? t("এক্সপোর্ট হচ্ছে…", "Exporting…") : t(`সব এক্সপোর্ট (${n(total)})`, `Export all (${total})`)}
        </Button>
      </div>

      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary-subtle px-4 py-2.5 text-meta font-medium text-primary">
          <span>{t(`${n(selected.size)} জন নির্বাচিত`, `${selected.size} selected`)}</span>
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => router.push(`/admin/sms-notice/send?recipients=${Array.from(selected).join(",")}`)}
              className="flex items-center gap-1.5 rounded-md bg-surface px-3 py-1.5 text-text-primary hover:bg-sunken"
            >
              <Send size={14} /> {t("এসএমএস পাঠান", "Send SMS")}
            </button>
            <button onClick={() => setSelected(new Set())} className="rounded-md px-3 py-1.5 hover:bg-sunken">
              {t("বাতিল", "Clear")}
            </button>
          </div>
        </div>
      ) : null}

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
                  checked={allOnPage}
                  indeterminate={someOnPage}
                  onChange={toggleAll}
                  aria-label={t("সব নির্বাচন করুন", "Select all")}
                />
              </TH>
              <SortableTH
                sortKey="name"
                sort={sort}
                onSort={(s) => setQuery({ sortKey: s?.key ?? "", sortDir: s?.dir ?? "", page: 1 })}
              >
                {t("শিক্ষক", "Teacher")}
              </SortableTH>
              <TH>{t("পদবি", "Designation")}</TH>
              <TH>{t("মূল বিষয়", "Main Subject")}</TH>
              <TH>{t("শ্রেণি শিক্ষক", "Class Teacher")}</TH>
              <SortableTH
                sortKey="status"
                sort={sort}
                onSort={(s) => setQuery({ sortKey: s?.key ?? "", sortDir: s?.dir ?? "", page: 1 })}
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
                        checked={selected.has(r.id)}
                        onChange={() => toggleOne(r.id)}
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
            `${n((page - 1) * PER_PAGE + 1)}–${n(Math.min(page * PER_PAGE, total))} দেখানো হচ্ছে · মোট ${n(total)} জন`,
            `Showing ${(page - 1) * PER_PAGE + 1}-${Math.min(page * PER_PAGE, total)} of ${total}`,
          )}
          pages={pages}
          current={page}
          onPageChange={(p) => setQuery({ page: p })}
        />
      ) : null}
    </div>
  );
}
