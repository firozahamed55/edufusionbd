"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UserPlus, Search, MoreVertical, Download } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import { Table, THead, TBody, TR, TH, TD, TableEmpty, Badge, ErrorState, Pagination, Breadcrumb } from "@/shared/ui";
import { useDebouncedValue } from "@/shared/lib/useDebouncedValue";
import { exportCsv } from "@/shared/lib/exportCsv";
import { useTeachers } from "./logic/useTeachers";

/**
 * Teacher list — LIVE from Supabase (teacher + designation + main subject +
 * class-teacher flag), RLS-scoped to the caller's institution. Search/filter/
 * pagination are all server-side; loading / empty / error states handled.
 */
export function ListScreen() {
  const { t, isBn } = useT();
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("");
  const [page, setPage] = useState(1);
  const debouncedQ = useDebouncedValue(q, 300);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, dept]);

  const { data, isLoading, isError, refetch } = useTeachers(page, debouncedQ, dept);
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const perPage = 20;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const departments = Array.from(new Set(rows.map((r) => r.department).filter((d): d is string => Boolean(d))));

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleOne = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  const toggleAll = () =>
    setSelected((s) => (s.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))));

  return (
    <div className="flex flex-col gap-7">
      {/* Header */}
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1">
          <Breadcrumb
            items={[
              { label: t("শিক্ষক ও কর্মী", "Teachers & Staff"), href: "/admin/teacher/registration" },
              { label: t("শিক্ষক তালিকা", "Teacher List") },
            ]}
          />
          <h1 className="mt-1.5 text-h4 font-bold text-text-primary">
            {t("শিক্ষক তালিকা", "Teacher List")}
          </h1>
          <p className="mt-1 text-meta text-text-muted">
            {t("সকল শিক্ষক ও কর্মীর তথ্য, বিষয় ও স্ট্যাটাস", "All teachers & staff — subject and status")}
          </p>
        </div>
        <Link
          href="/admin/teacher/registration"
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-text-on-primary hover:bg-primary-hover"
        >
          <UserPlus size={16} /> {t("নতুন শিক্ষক", "New Teacher")}
        </Link>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border-strong bg-surface px-3 py-2.5 sm:max-w-75 sm:flex-none">
          <Search size={16} className="text-text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("নাম, আইডি বা মোবাইল খুঁজুন", "Search name, ID or mobile")}
            aria-label={t("শিক্ষক খুঁজুন", "Search teachers")}
            className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
          />
        </div>
        <div className="hidden flex-1 sm:block" />
        <select
          value={dept}
          onChange={(e) => setDept(e.target.value)}
          aria-label={t("বিভাগ ফিল্টার", "Filter by department")}
          className="rounded-lg border border-border-strong bg-surface px-3 py-2.5 text-meta font-medium text-text-secondary"
        >
          <option value="">{t("বিভাগ: সব", "Department: All")}</option>
          {departments.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <button
          onClick={() => exportCsv(`teachers-${new Date().toISOString().slice(0, 10)}.csv`, rows.map((r) => ({
            Name: r.name_en,
            Email: r.email ?? "",
            Designation: r.designation ?? "",
            Department: r.department ?? "",
            Status: r.status,
          })))}
          className="flex items-center gap-1.5 rounded-lg border border-border-strong bg-surface px-3 py-2.5 text-meta font-medium text-text-secondary hover:bg-sunken"
        >
          <Download size={14} /> {t("এক্সপোর্ট", "Export")}
        </button>
      </div>

      {selected.size > 0 ? (
        <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary-subtle px-4 py-2.5 text-meta font-medium text-primary">
          <span>{t(`${selected.size} জন নির্বাচিত`, `${selected.size} selected`)}</span>
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => { window.location.href = `/admin/sms-notice/send?recipients=${Array.from(selected).join(",")}`; }}
              className="rounded-md bg-surface px-3 py-1.5 text-text-primary hover:bg-sunken"
            >
              {t("এসএমএস পাঠান", "Send SMS")}
            </button>
            <button onClick={() => setSelected(new Set())} className="rounded-md px-3 py-1.5 hover:bg-sunken">
              {t("বাতিল", "Clear")}
            </button>
          </div>
        </div>
      ) : null}

      {/* Table */}
      {isError ? (
        <ErrorState
          title={t("শিক্ষক তালিকা লোড করা যায়নি", "Couldn't load teachers")}
          action={
            <button
              onClick={() => refetch()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-text-on-primary"
            >
              {t("পুনরায় চেষ্টা", "Retry")}
            </button>
          }
        />
      ) : (
        <Table minWidth={720}>
          <THead>
            <TR>
              <TH className="w-10">
                <input
                  type="checkbox"
                  checked={rows.length > 0 && selected.size === rows.length}
                  onChange={toggleAll}
                  aria-label={t("সব নির্বাচন করুন", "Select all")}
                />
              </TH>
              <TH>{t("শিক্ষক", "Teacher")}</TH>
              <TH>{t("পদবি", "Designation")}</TH>
              <TH>{t("মূল বিষয়", "Main Subject")}</TH>
              <TH>{t("শ্রেণি শিক্ষক", "Class Teacher")}</TH>
              <TH>{t("স্ট্যাটাস", "Status")}</TH>
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
              <TableEmpty
                colSpan={7}
                title={t("কোনো শিক্ষক পাওয়া যায়নি", "No teachers found")}
              />
            ) : (
              rows.map((r) => {
                const name = isBn ? r.name_bn : r.name_en;
                return (
                  <TR key={r.id}>
                    <TD>
                      <input
                        type="checkbox"
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
                      {r.designation ? (
                        <Badge tone="info">{r.designation}</Badge>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
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
                      <button
                        aria-label={t("অ্যাকশন", "Actions")}
                        className="grid size-8 place-items-center rounded-md text-text-muted hover:bg-sunken"
                      >
                        <MoreVertical size={18} />
                      </button>
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
            `${(page - 1) * perPage + 1}–${Math.min(page * perPage, total)} দেখানো হচ্ছে · মোট ${total} জন`,
            `Showing ${(page - 1) * perPage + 1}-${Math.min(page * perPage, total)} of ${total}`,
          )}
          pages={pages}
          current={page}
          onPageChange={setPage}
        />
      ) : null}
    </div>
  );
}
