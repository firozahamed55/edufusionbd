"use client";

import { useState } from "react";
import { UserPlus, Search, ChevronDown, MoreVertical } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import { Table, THead, TBody, TR, TH, TD, TableEmpty, Badge, ErrorState } from "@/shared/ui";
import { useTeachers } from "./logic/useTeachers";

/**
 * Teacher list — LIVE from Supabase (teacher + designation + main subject +
 * class-teacher flag), RLS-scoped to the caller's institution. Search filters
 * client-side; loading / empty / error states handled. No demo data.
 */
export function ListScreen() {
  const { t, isBn } = useT();
  const { data, isLoading, isError, refetch } = useTeachers();
  const [q, setQ] = useState("");

  const term = q.trim().toLowerCase();
  const rows = (data ?? []).filter(
    (r) =>
      !term ||
      r.name_bn.toLowerCase().includes(term) ||
      r.name_en.toLowerCase().includes(term) ||
      (r.email ?? "").toLowerCase().includes(term),
  );

  return (
    <div className="flex flex-col gap-7">
      {/* Header */}
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-1.5 text-[13px] text-text-muted">
            <span>{t("শিক্ষক ও কর্মী", "Teachers & Staff")}</span>
            <span>›</span>
            <span>{t("শিক্ষক তালিকা", "Teacher List")}</span>
          </div>
          <h1 className="mt-1.5 text-[22px] font-bold text-text-primary">
            {t("শিক্ষক তালিকা", "Teacher List")}
          </h1>
          <p className="mt-1 text-[13px] text-text-muted">
            {t("সকল শিক্ষক ও কর্মীর তথ্য, বিষয় ও স্ট্যাটাস", "All teachers & staff — subject and status")}
          </p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-text-on-primary hover:bg-primary-hover">
          <UserPlus size={16} /> {t("নতুন শিক্ষক", "New Teacher")}
        </button>
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
        <button className="flex items-center gap-1.5 rounded-lg border border-border-strong bg-surface px-3 py-2.5 text-[13px] font-medium text-text-secondary hover:bg-sunken">
          {t("বিভাগ: সব", "Department: All")}
          <ChevronDown size={14} className="text-text-muted" />
        </button>
      </div>

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
                  {Array.from({ length: 6 }).map((__, j) => (
                    <TD key={j}>
                      <span className="block h-5 animate-pulse rounded bg-sunken" />
                    </TD>
                  ))}
                </TR>
              ))
            ) : rows.length === 0 ? (
              <TableEmpty
                colSpan={6}
                title={t("কোনো শিক্ষক পাওয়া যায়নি", "No teachers found")}
              />
            ) : (
              rows.map((r) => {
                const name = isBn ? r.name_bn : r.name_en;
                return (
                  <TR key={r.id}>
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
                    <TD className="text-[13px] font-medium text-text-secondary">
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
    </div>
  );
}
