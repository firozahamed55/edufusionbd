"use client";

import { FileDown, Wallet } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { Skeleton, EmptyState, ErrorState } from "@/shared/ui";
import { useUnpaidByInstitute } from "../../logic/hooks";

/** Fee · Dues (by Institute) — live class/section-wise dues summary. */
export function UnpaidInstituteScreen() {
  const { t, n, isBn } = useT();
  const q = useUnpaidByInstitute();
  const d = q.data;

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-[22px] font-bold text-text-primary">{t("বকেয়া তথ্য", "Dues")}</h1>
        <p className="mt-1 flex items-center gap-1.5 text-[13px] text-text-muted">{t("ফি ও অর্থ", "Fees & Finance")} <span>•</span> {t("প্রতিষ্ঠান অনুযায়ী বকেয়ার সারসংক্ষেপ", "Institute-wide dues summary")}</p>
      </header>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface p-5 shadow-e3">
        <span className="text-[13px] text-text-muted">{t("শিক্ষাবর্ষ", "Academic Year")}: <b className="text-text-secondary tnum">{n(2026)}</b></span>
        <div className="flex-1" />
        <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-text-on-primary hover:bg-primary-hover disabled:opacity-60" disabled>
          <FileDown size={16} /> {t("PDF ডাউনলোড", "Download PDF")}
        </button>
      </div>

      {q.isLoading ? (
        <div className="flex flex-col gap-2 rounded-2xl bg-surface p-5 shadow-e3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-11" />)}</div>
      ) : q.isError ? (
        <ErrorState title={t("সারসংক্ষেপ লোড করা যায়নি", "Could not load summary")} description={q.error instanceof Error ? q.error.message : undefined} />
      ) : !d || d.rows.length === 0 ? (
        <EmptyState icon={<Wallet size={22} />} title={t("কোনো বকেয়া তথ্য নেই", "No dues data")} />
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-surface shadow-e3">
          <div className="min-w-180">
            <div className="flex items-center gap-3 border-b border-border-default px-5 py-4">
              <p className="flex-1 text-base font-semibold text-text-primary">{t("শ্রেণি-ভিত্তিক বকেয়ার সারসংক্ষেপ", "Class-wise dues summary")}</p>
              <span className="text-[13px] font-semibold text-primary">{t("মোট সারি", "Rows")}: {n(d.rows.length)}</span>
            </div>
            <div className="flex items-center gap-3 border-b border-border-default px-5 py-3 text-[12.5px] font-semibold text-text-muted">
              <div className="flex-1">{t("শ্রেণি", "Class")}</div>
              <div className="w-35">{t("শাখা", "Section")}</div>
              <div className="w-32.5 text-right">{t("মোট শিক্ষার্থী", "Total")}</div>
              <div className="w-32.5 text-right">{t("বকেয়া শিক্ষার্থী", "Due students")}</div>
              <div className="w-32.5 text-right">{t("মোট বকেয়া", "Total due")}</div>
            </div>
            {d.rows.map((r, i) => (
              <div key={`${r.numeric_level}-${r.sec_name}-${i}`} className={cn("flex items-center gap-3 px-5 py-3.5", i % 2 === 1 && "bg-sunken")}>
                <div className="flex-1 text-sm font-semibold text-text-primary">{isBn ? r.cls_bn : r.cls_en}</div>
                <div className="w-35 text-[13px] text-text-secondary">{r.sec_name ?? "—"}</div>
                <div className="w-32.5 text-right text-[13px] text-text-secondary tnum">{n(r.total_students)}</div>
                <div className="w-32.5 text-right text-[13px] font-semibold text-danger-fg tnum">{n(r.due_students)}</div>
                <div className="w-32.5 text-right text-sm font-bold text-text-primary tnum">৳{n(r.due_amount)}</div>
              </div>
            ))}
            <div className="flex items-center gap-3 bg-primary px-5 py-3.5 text-text-on-primary">
              <div className="flex-1 text-sm font-semibold">{t("সর্বমোট", "Grand total")}</div>
              <div className="w-35" />
              <div className="w-32.5 text-right text-sm font-bold tnum">{n(d.total_students)}</div>
              <div className="w-32.5 text-right text-sm font-bold tnum">{n(d.due_students)}</div>
              <div className="w-32.5 text-right text-sm font-bold tnum">৳{n(d.total_due)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
