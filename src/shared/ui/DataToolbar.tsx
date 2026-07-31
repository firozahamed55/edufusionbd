"use client";

import { Search, Download, X } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { Button } from "./Button";
import type { ReactNode } from "react";

/**
 * The visual half of the data-interaction contract (SRA A-0.1). `useDataScreen`
 * owns the state; this owns the chrome that state needs — search, a slot for
 * filters, export, and the bulk-action bar that appears on selection.
 *
 * Deliberately small and slot-based. The Teacher Directory hand-rolled all of
 * this inline, and copying that markup to thirteen more screens is how a design
 * system ends up with thirteen slightly different search boxes.
 */

export function DataToolbar({
  q,
  onQChange,
  placeholder,
  searchLabel,
  filters,
  onExportPage,
  onExportAll,
  exportPageCount,
  exportAllCount,
  exportingAll,
  onReset,
  isFiltered,
  className,
}: {
  q?: string;
  onQChange?: (value: string) => void;
  placeholder?: string;
  /** Accessible name for the search box — it has no visible label. */
  searchLabel?: string;
  /** `<select>`s, date ranges, anything screen-specific. */
  filters?: ReactNode;
  onExportPage?: () => void;
  onExportAll?: () => void;
  exportPageCount?: number;
  exportAllCount?: number;
  exportingAll?: boolean;
  onReset?: () => void;
  isFiltered?: boolean;
  className?: string;
}) {
  const { t, n } = useT();

  return (
    <div className={cn("flex flex-wrap items-center gap-2.5", className)}>
      {onQChange ? (
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border-control bg-surface px-3 py-2.5 sm:max-w-75 sm:flex-none">
          <Search size={16} className="text-text-muted" />
          <input
            value={q ?? ""}
            onChange={(e) => onQChange(e.target.value)}
            placeholder={placeholder ?? t("খুঁজুন", "Search")}
            aria-label={searchLabel ?? placeholder ?? t("খুঁজুন", "Search")}
            className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
          />
        </div>
      ) : null}

      {filters}

      <div className="hidden flex-1 sm:block" />

      {isFiltered && onReset ? (
        <Button variant="ghost" onClick={onReset}>
          <X size={14} /> {t("ফিল্টার সরান", "Clear filters")}
        </Button>
      ) : null}

      {onExportPage ? (
        <Button variant="secondary" onClick={onExportPage} disabled={!exportPageCount}>
          <Download size={14} />{" "}
          {t(`এই পাতা এক্সপোর্ট (${n(exportPageCount ?? 0)})`, `Export this page (${exportPageCount ?? 0})`)}
        </Button>
      ) : null}

      {/*
        A second, bounded fetch — NOT a re-export of the current page. Exporting
        "all" from the page in memory is the defect that makes a school's
        spreadsheet quietly disagree with the system it came from.
      */}
      {onExportAll ? (
        <Button variant="secondary" onClick={onExportAll} disabled={!exportAllCount} loading={exportingAll}>
          {!exportingAll ? <Download size={14} /> : null}
          {exportingAll
            ? t("এক্সপোর্ট হচ্ছে…", "Exporting…")
            : t(`সব এক্সপোর্ট (${n(exportAllCount ?? 0)})`, `Export all (${exportAllCount ?? 0})`)}
        </Button>
      ) : null}
    </div>
  );
}

/** The bar that appears once rows are selected. Renders nothing at zero. */
export function BulkBar({
  count,
  onClear,
  children,
}: {
  count: number;
  onClear: () => void;
  /** The actions themselves — screen-specific by nature. */
  children?: ReactNode;
}) {
  const { t, n } = useT();
  if (count === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary-subtle px-4 py-2.5 text-meta font-medium text-primary">
      <span>{t(`${n(count)} টি নির্বাচিত`, `${count} selected`)}</span>
      <div className="ml-auto flex gap-2">
        {children}
        <button onClick={onClear} className="rounded-md px-3 py-1.5 hover:bg-sunken">
          {t("বাতিল", "Clear")}
        </button>
      </div>
    </div>
  );
}

/** A bulk action styled to sit inside `BulkBar`. */
export function BulkAction({
  onClick,
  icon,
  children,
}: {
  onClick: () => void;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-md bg-surface px-3 py-1.5 text-text-primary hover:bg-sunken"
    >
      {icon}
      {children}
    </button>
  );
}
