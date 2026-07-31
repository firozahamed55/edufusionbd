"use client";

import { useEffect, useState } from "react";
import { Search, type LucideIcon } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { Field, Select, Input, Button } from "@/shared/ui";

/**
 * Shared attendance UI parts — status selector pills, SMS toggle, summary dots
 * and the per-column filter input. Reused by Section, Exam and Update screens
 * so the marking UI is identical everywhere. Active pills use the exact Figma
 * saturated colors (green-600 / red-600 / amber-600 / violet-700); inactive use
 * the tinted status token so they theme in light & dark.
 */

const solidTone = {
  success: "bg-green-600 text-white",
  danger: "bg-red-600 text-white",
  warning: "bg-amber-600 text-white",
  exam: "bg-violet-700 text-white",
  leave: "bg-sky-600 text-white",
} as const;

const tintTone = {
  success: "bg-success-bg text-success-fg",
  danger: "bg-danger-bg text-danger-fg",
  warning: "bg-warning-bg text-warning-fg",
  exam: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  leave: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
} as const;

export type AttTone = keyof typeof solidTone;

/**
 * One status choice for one student.
 *
 * It IS the interactive element now. It used to render its own `<button>` and
 * every call site wrapped it in a second `<button>` — invalid nesting, which
 * browsers recover from unpredictably and screen readers announce as two
 * controls where there is one.
 *
 * `role="radio"` inside the caller's `role="radiogroup"`, because "exactly one
 * of present/absent/late/leave" is precisely what a radio group means. That
 * also buys the roving-tabindex behaviour assistive tech already expects: one
 * tab stop per student, not four.
 */
export function StatusPill({
  tone,
  label,
  active,
  onSelect,
  ref,
  onKeyDown,
}: {
  tone: AttTone;
  label: string;
  active: boolean;
  onSelect: () => void;
  ref?: React.Ref<HTMLButtonElement>;
  onKeyDown?: React.KeyboardEventHandler;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      // Roving tabindex: Tab reaches the row's current answer, arrows move
      // between rows, digits pick a status.
      tabIndex={active ? 0 : -1}
      ref={ref}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-meta font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        active ? solidTone[tone] : cn(tintTone[tone], "hover:brightness-95"),
      )}
    >
      <span className={cn("size-1.5 rounded-full", active ? "bg-white" : "bg-current")} />
      {label}
    </button>
  );
}

export function SummaryDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-2 rounded-full", color)} />
      {label}
    </span>
  );
}

export function Toggle({ on }: { on?: boolean }) {
  return (
    <span className={cn("relative inline-flex h-5 w-9 items-center rounded-full", on ? "bg-success-fg" : "bg-border-strong")}>
      <span className={cn("absolute size-4 rounded-full bg-white", on ? "right-0.5" : "left-0.5")} />
    </span>
  );
}

/**
 * The KPI tile used by Report and Analytics. Both screens carried a private,
 * identical copy; the third would have made three.
 */
const softTone = {
  success: "bg-success-bg text-success-fg",
  primary: "bg-primary-subtle text-primary",
  danger: "bg-danger-bg text-danger-fg",
  info: "bg-info-bg text-info-fg",
} as const;

export function SoftStat({
  tone,
  icon: Icon,
  value,
  label,
}: {
  tone: keyof typeof softTone;
  icon: LucideIcon;
  value: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3.5 rounded-2xl bg-surface p-5 shadow-e1">
      <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", softTone[tone])}>
        <Icon size={22} />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-text-primary tnum">{value}</p>
        <p className="truncate text-meta text-text-muted">{label}</p>
      </div>
    </div>
  );
}

/**
 * Section + date range behind an explicit Search, shared by Report and
 * Analytics. The trigger is deliberate and wired (SRA A-0.3 kept exactly this
 * pattern): a date range is only meaningful once BOTH ends are chosen, so
 * querying on every keystroke would fire against half-typed years.
 *
 * `onApply` receives all three at once because two `setFilter` calls in one
 * handler drop one another — see `useDataScreen#setFilters`.
 */
export function SummaryFilterBar({
  sectionId,
  from,
  to,
  sectionOptions,
  sectionPlaceholder,
  sectionRequired,
  onApply,
}: {
  sectionId: string;
  from: string;
  to: string;
  sectionOptions: { value: string; label: string }[];
  sectionPlaceholder: string;
  sectionRequired?: boolean;
  onApply: (next: { sectionId: string; from: string; to: string }) => void;
}) {
  const { t } = useT();
  const [draft, setDraft] = useState({ sectionId, from, to });
  // The URL is the source of truth — a back button or a shared link must move
  // the controls, not just the results.
  useEffect(() => setDraft({ sectionId, from, to }), [sectionId, from, to]);

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-surface p-5 shadow-e1">
      <Field label={t("শ্রেণি ও শাখা", "Class & section")} required={sectionRequired} className="w-65 max-w-full">
        <Select
          value={draft.sectionId}
          placeholder={sectionPlaceholder}
          options={sectionOptions}
          onChange={(e) => setDraft((p) => ({ ...p, sectionId: e.target.value }))}
        />
      </Field>
      <Field label={t("শুরুর তারিখ", "Start date")} className="w-45">
        <Input type="date" value={draft.from} max={draft.to} onChange={(e) => setDraft((p) => ({ ...p, from: e.target.value }))} />
      </Field>
      <Field label={t("শেষ তারিখ", "End date")} className="w-45">
        <Input type="date" value={draft.to} min={draft.from} onChange={(e) => setDraft((p) => ({ ...p, to: e.target.value }))} />
      </Field>
      <Button
        variant="primary"
        className="h-10.5 px-6"
        disabled={sectionRequired && !draft.sectionId}
        onClick={() => onApply(draft)}
      >
        <Search size={16} /> {t("অনুসন্ধান", "Search")}
      </Button>
    </div>
  );
}

export function AttColFilter({ className, placeholder }: { className?: string; placeholder?: string }) {
  return (
    <div className={className}>
      <input
        placeholder={placeholder}
        className="h-8 w-full rounded-md border border-border-strong bg-surface px-2 text-xs text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none"
      />
    </div>
  );
}
