"use client";

import { useState } from "react";
import { FileDown, Wallet } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { Field, Select, Skeleton, EmptyState, ErrorState, Breadcrumb } from "@/shared/ui";
import { useClassSectionsLookup } from "@/shared/services/lookups/hooks";
import type { Option } from "@/shared/services/lookups/api";
import { useUnpaidBySection } from "../../logic/hooks";

/** Fee · Dues (by Section) — live per-student outstanding dues for a section. */
export function UnpaidSectionScreen() {
  const { t, n, isBn } = useT();
  const [sectionId, setSectionId] = useState("");
  const sections = useClassSectionsLookup();
  const q = useUnpaidBySection(sectionId || null);
  const opt = (list?: Option[]) => (list ?? []).map((o) => ({ value: o.value, label: isBn ? o.label_bn : o.label_en }));
  const total = (q.data ?? []).reduce((s, r) => s + r.due, 0);

  return (
    <div className="flex flex-col gap-5">
      <header>
        <Breadcrumb items={[{ label: t("ফি ও অর্থ", "Fees & Finance"), href: "/admin/fee/quick-collection-list" }, { label: t("বকেয়া তথ্য", "Dues") }]} />
        <h1 className="mt-1.5 text-h4 font-bold text-text-primary">{t("বকেয়া তথ্য", "Dues")}</h1>
        <p className="mt-1 text-meta text-text-muted">{t("সেকশন অনুযায়ী বকেয়া শিক্ষার্থী তালিকা", "Section-wise unpaid students")}</p>
      </header>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-surface p-5 shadow-e3">
        <Field label={t("শ্রেণি ও শাখা", "Class & Section")} required className="w-75 max-w-full">
          <Select value={sectionId} placeholder={sections.isLoading ? t("লোড হচ্ছে…", "Loading…") : t("নির্বাচন করুন", "Select")} options={opt(sections.data)} onChange={(e) => setSectionId(e.target.value)} />
        </Field>
        <div className="flex-1" />
        <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-text-on-primary hover:bg-primary-hover disabled:opacity-60" disabled>
          <FileDown size={16} /> {t("PDF ডাউনলোড", "Download PDF")}
        </button>
      </div>

      {!sectionId ? (
        <EmptyState icon={<Wallet size={22} />} title={t("একটি শাখা নির্বাচন করুন", "Select a section")} />
      ) : q.isLoading ? (
        <div className="flex flex-col gap-2 rounded-2xl bg-surface p-5 shadow-e3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : q.isError ? (
        <ErrorState title={t("তালিকা লোড করা যায়নি", "Could not load list")} description={q.error instanceof Error ? q.error.message : undefined} />
      ) : (q.data ?? []).length === 0 ? (
        <EmptyState icon={<Wallet size={22} />} title={t("এই শাখায় কোনো বকেয়া নেই", "No dues in this section")} />
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-surface shadow-e3">
          <div className="min-w-240">
            <div className="flex items-center gap-3 border-b border-border-default px-5 py-4">
              <p className="flex-1 text-base font-semibold text-text-primary">{t("বকেয়া শিক্ষার্থী তালিকা", "Unpaid student list")}</p>
              <span className="text-meta font-semibold text-primary">{t("মোট পাওয়া গেছে", "Total found")}: {n((q.data ?? []).length)}</span>
            </div>
            <div className="flex items-center gap-3 border-b border-border-default px-5 py-3 text-[12.5px] font-semibold text-text-muted">
              <div className="w-30">{t("শিক্ষার্থী আইডি", "Student ID")}</div>
              <div className="w-15">{t("রোল", "Roll")}</div>
              <div className="w-37.5">{t("নাম", "Name")}</div>
              <div className="flex-1">{t("বকেয়ার বিবরণ", "Dues detail")}</div>
              <div className="w-25 text-right">{t("মোট বকেয়া", "Total due")}</div>
            </div>
            {(q.data ?? []).map((r, i) => (
              <div key={r.studentId} className={cn("flex items-start gap-3 px-5 py-3.5", i % 2 === 1 && "bg-sunken")}>
                <div className="w-30 font-latin text-meta font-medium text-text-secondary tnum">{r.code ? n(r.code) : "—"}</div>
                <div className="w-15 text-meta text-text-secondary tnum">{r.roll != null ? n(r.roll) : "—"}</div>
                <div className="w-37.5 text-sm font-medium text-text-primary">{isBn ? r.name_bn : r.name_en}</div>
                <div className="flex-1 text-[12.5px] leading-relaxed text-text-muted">{r.detail || "—"}</div>
                <div className="w-25 text-right text-sm font-bold text-text-primary tnum">৳{n(r.due)}</div>
              </div>
            ))}
            <div className="flex items-center gap-3 border-t border-border-strong bg-primary-subtle px-5 py-3.5 text-sm font-bold text-primary">
              <div className="flex-1">{t("সর্বমোট", "Grand total")}</div>
              <div className="w-25 text-right tnum">৳{n(total)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
