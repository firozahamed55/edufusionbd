"use client";

import { useState } from "react";
import { Search, Pencil } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { Button, Field, Select } from "@/shared/ui";
import { useClassSections, useStudentsBySection } from "./logic/useUpdateClass";

/**
 * Student · Class List / Update Class Info — LIVE from Supabase.
 * Pick a class-section → students of that section (with roll, primary guardian,
 * DOB, contact) load from `student_enrollment`. RLS-scoped. No demo data.
 */
export function UpdateClassScreen() {
  const { t, n, isBn } = useT();
  const [section, setSection] = useState("");
  const [nameFilter, setNameFilter] = useState("");

  const { data: sections = [] } = useClassSections();
  const { data: students = [], isLoading, isError, refetch } = useStudentsBySection(section || null);

  const sectionOptions = sections.map((s) => ({
    value: s.value,
    label: isBn ? s.label_bn : s.label_en,
  }));

  const fmtDate = (iso: string) => {
    if (!iso) return "—";
    const [y, m, d] = iso.split("-");
    return n(`${d}/${m}/${y}`);
  };

  const filter = nameFilter.trim().toLowerCase();
  const rows = students.filter(
    (r) =>
      !filter ||
      r.name_en.toLowerCase().includes(filter) ||
      r.name_bn.toLowerCase().includes(filter) ||
      (r.code ?? "").toLowerCase().includes(filter),
  );

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="mt-1.5 text-h4 font-bold text-text-primary">
          {t("শ্রেণি তথ্য হালনাগাদ", "Update Class Info")}
        </h1>
        <p className="mt-1 text-meta text-text-muted">
          {t("শ্রেণি নির্বাচন করে শিক্ষার্থী তালিকা দেখুন", "Select a class-section to view its students")}
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-surface p-5 shadow-e1">
        <Field label={t("শ্রেণি ও শাখা", "Class & Section")} required className="w-90 max-w-full">
          <Select
            value={section}
            onChange={(e) => setSection(e.target.value)}
            options={sectionOptions}
            placeholder={t("শ্রেণি নির্বাচন করুন", "Select class-section")}
          />
        </Field>
        <Button variant="primary" className="h-10.5 px-6" onClick={() => refetch()}>
          <Search size={16} /> {t("অনুসন্ধান", "Search")}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border-default bg-surface shadow-e1">
        <div className="min-w-220">
          <div className="flex items-center gap-3 border-b border-border-default px-5 py-4">
            <p className="flex-1 text-base font-semibold text-text-primary">
              {t("শিক্ষার্থী তালিকা", "Student List")}
            </p>
            <span className="text-meta font-semibold text-primary">
              {t("মোট পাওয়া গেছে:", "Total found:")} {n(rows.length)}
            </span>
          </div>
          <div className="flex items-center gap-3 px-5 pt-4 text-meta font-semibold text-text-muted">
            <div className="w-30">{t("শিক্ষার্থী আইডি", "Student ID")}</div>
            <div className="w-15">{t("রোল", "Roll")}</div>
            <div className="w-42.5">{t("নাম", "Name")}</div>
            <div className="w-40">{t("পিতার নাম", "Father's Name")}</div>
            <div className="w-30">{t("জন্ম তারিখ", "Date of Birth")}</div>
            <div className="flex-1">{t("অভিভাবকের ফোন নম্বর", "Guardian Phone")}</div>
            <div className="w-17.5 text-right">{t("অ্যাকশন", "Action")}</div>
          </div>
          <div className="flex items-center gap-3 border-b border-border-default px-5 pb-3 pt-2">
            <div className="w-30" />
            <div className="w-15" />
            <div className="w-42.5">
              <input
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
                placeholder={t("নাম/আইডি", "Name/ID")}
                className="h-8 w-full rounded-md border border-border-strong bg-surface px-2 text-xs text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none"
              />
            </div>
            <div className="w-40" />
            <div className="w-30" />
            <div className="flex-1" />
            <div className="w-17.5" />
          </div>

          {!section ? (
            <p className="px-5 py-12 text-center text-sm text-text-muted">
              {t("তালিকা দেখতে একটি শ্রেণি নির্বাচন করুন", "Select a class-section to see the list")}
            </p>
          ) : isError ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-danger-fg">{t("তালিকা লোড করা যায়নি", "Couldn't load the list")}</p>
              <button onClick={() => refetch()} className="mt-2 rounded-md px-1 py-0.5 text-sm font-semibold text-primary hover:underline">
                {t("পুনরায় চেষ্টা", "Retry")}
              </button>
            </div>
          ) : isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                <div className="h-5 flex-1 animate-pulse rounded bg-sunken" />
              </div>
            ))
          ) : rows.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-text-muted">
              {t("এই শ্রেণিতে কোনো শিক্ষার্থী নেই", "No students in this class-section")}
            </p>
          ) : (
            rows.map((r, i) => (
              <div
                key={r.enrollmentId}
                className={cn("flex items-center gap-3 px-5 py-3.5", i % 2 === 1 && "bg-sunken")}
              >
                <div className="w-30 font-latin text-meta font-medium text-text-secondary">{r.code ?? "—"}</div>
                <div className="w-15 text-meta text-text-secondary">{r.roll != null ? n(r.roll) : "—"}</div>
                <div className="w-42.5 text-sm font-medium text-text-primary">{isBn ? r.name_bn : r.name_en}</div>
                <div className="w-40 text-meta text-text-secondary">{r.father ?? "—"}</div>
                <div className="w-30 text-meta text-text-secondary">{fmtDate(r.dob)}</div>
                <div className="flex-1 font-latin text-meta text-text-secondary">{r.phone ? n(r.phone) : "—"}</div>
                <div className="flex w-17.5 justify-end">
                  <button
                    aria-label={t("সম্পাদনা", "Edit")}
                    className="grid size-8 place-items-center rounded-lg bg-primary text-text-on-primary hover:bg-primary-hover"
                  >
                    <Pencil size={15} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
