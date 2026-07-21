"use client";

import { useState } from "react";
import Link from "next/link";
import { ShoppingCart, Users } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { Field, Select, Skeleton, EmptyState, ErrorState, Breadcrumb } from "@/shared/ui";
import { useClassSectionsLookup } from "@/shared/services/lookups/hooks";
import { useSectionStudents } from "@/shared/services/roster/hooks";
import type { Option } from "@/shared/services/lookups/api";

/** Fee · Quick Collection (list) — pick a section, choose a student to collect. */
export function QuickCollectionListScreen() {
  const { t, n, isBn } = useT();
  const [sectionId, setSectionId] = useState("");
  const sections = useClassSectionsLookup();
  const students = useSectionStudents(sectionId || null);
  const opt = (list?: Option[]) => (list ?? []).map((o) => ({ value: o.value, label: isBn ? o.label_bn : o.label_en }));
  const rows = students.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <header>
        <Breadcrumb
          items={[
            { label: t("ফি ও অর্থ", "Fees & Finance"), href: "/admin/fee/quick-collection-list" },
            { label: t("দ্রুত ফি আদায়", "Fast fee collection") },
            { label: t("শিক্ষার্থী তালিকা", "Student list") },
          ]}
        />
        <h1 className="mt-1.5 text-h4 font-bold text-text-primary">{t("কুইক কালেকশন", "Quick Collection")}</h1>
      </header>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-surface p-5 shadow-e3">
        <Field label={t("শাখা", "Section")} required className="w-90 max-w-full">
          <Select value={sectionId} placeholder={sections.isLoading ? t("লোড হচ্ছে…", "Loading…") : t("নির্বাচন করুন", "Select")} options={opt(sections.data)} onChange={(e) => setSectionId(e.target.value)} />
        </Field>
      </div>

      {!sectionId ? (
        <EmptyState icon={<Users size={22} />} title={t("একটি শাখা নির্বাচন করুন", "Select a section")} description={t("ফি আদায়ের জন্য শিক্ষার্থী তালিকা লোড করুন।", "Load the student list to collect fees.")} />
      ) : students.isLoading ? (
        <div className="flex flex-col gap-2 rounded-2xl bg-surface p-5 shadow-e3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-11" />)}</div>
      ) : students.isError ? (
        <ErrorState title={t("তালিকা লোড করা যায়নি", "Could not load list")} description={students.error instanceof Error ? students.error.message : undefined} />
      ) : rows.length === 0 ? (
        <EmptyState icon={<Users size={22} />} title={t("এই শাখায় কোনো শিক্ষার্থী নেই", "No students in this section")} />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-surface shadow-e3">
          <div className="flex items-center gap-3 border-b border-border-default px-5 py-4">
            <p className="flex-1 text-base font-semibold text-text-primary">{t("শিক্ষার্থী তালিকা", "Student list")}</p>
            <span className="text-meta font-semibold text-primary">{t("মোট পাওয়া গেছে", "Total found")}: {n(rows.length)}</span>
          </div>
          <div className="flex items-center gap-3 px-5 pt-4 pb-2 text-[12.5px] font-semibold text-text-muted">
            <div className="w-37.5">{t("শিক্ষার্থী আইডি", "Student ID")}</div>
            <div className="w-20">{t("রোল", "Roll")}</div>
            <div className="flex-1">{t("নাম", "Name")}</div>
            <div className="w-35">{t("ক্যাটাগরি", "Category")}</div>
            <div className="w-20 text-right">{t("অ্যাকশন", "Action")}</div>
          </div>
          {rows.map((r, i) => (
            <div key={r.enrollmentId} className={cn("flex items-center gap-3 px-5 py-3.5", i % 2 === 1 && "bg-sunken")}>
              <div className="w-37.5 font-latin text-meta font-medium text-text-secondary tnum">{r.code ? n(r.code) : "—"}</div>
              <div className="w-20 text-meta text-text-secondary tnum">{r.roll != null ? n(r.roll) : "—"}</div>
              <div className="flex-1 text-sm font-medium text-text-primary">{isBn ? r.name_bn : r.name_en}</div>
              <div className="w-35"><span className="inline-block rounded-full bg-primary-subtle px-2.5 py-1 text-xs font-semibold text-primary">{r.category ?? t("সাধারণ", "General")}</span></div>
              <div className="flex w-20 justify-end">
                <Link href={`/admin/fee/quick-collection-form?student=${r.studentId}`} aria-label={t("আদায়", "Collect")} className="grid size-8 place-items-center rounded-lg bg-primary text-text-on-primary hover:bg-primary-hover">
                  <ShoppingCart size={15} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
