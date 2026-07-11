"use client";

import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import { cn } from "@/shared/lib/cn";
import type { ButtonHTMLAttributes } from "react";

/**
 * Table pagination footer — matches the Figma "N–M দেখানো হচ্ছে · মোট T জন"
 * + page pills + per-page selector used across the student/fee/exam list screens.
 * Fully localized: page numbers and the per-page count render in the active
 * locale, and the prev/next affordances carry localized aria-labels.
 */
export function Pagination({
  label,
  pages = 4,
  current = 1,
  perPage,
}: {
  label: string;
  pages?: number;
  current?: number;
  /** Per-page count. Accepts Bengali or ASCII digits; defaults to 10. */
  perPage?: string | number;
}) {
  const { t, n } = useT();
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-border-default px-5 py-3.5">
      <span className="flex-1 text-[13px] text-text-muted">{label}</span>
      <div className="flex items-center gap-1.5">
        <PageBtn aria-label={t("আগে", "Previous")}>
          <ChevronLeft size={15} />
        </PageBtn>
        {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
          <PageBtn key={p} active={p === current}>
            {n(p)}
          </PageBtn>
        ))}
        <PageBtn aria-label={t("পরে", "Next")}>
          <ChevronRight size={15} />
        </PageBtn>
        <button className="ml-1 flex h-8 items-center gap-1 rounded-lg border border-border-strong bg-surface px-2.5 text-[13px] font-medium text-text-secondary hover:bg-sunken">
          {n(perPage ?? 10)}
          <ChevronDown size={13} className="text-text-muted" />
        </button>
      </div>
    </div>
  );
}

function PageBtn({
  active,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      className={cn(
        "grid size-8 place-items-center rounded-lg text-[13px] font-medium transition-colors",
        active
          ? "bg-primary text-text-on-primary"
          : "border border-border-strong bg-surface text-text-secondary hover:bg-sunken",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
