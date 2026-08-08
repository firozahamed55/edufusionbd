"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/shared/lib/cn";

/**
 * "What points at this", rendered inside a confirm dialog (settings audit M-16).
 *
 * A confirm that says only "Delete class?" asks the operator to remember what
 * a class holds. This says it: *1 section · 35 enrolled students*. Rows marked
 * blocking are rendered in the danger tone and, upstream, stop the delete
 * entirely — a hard reference is not something to warn about, it is something
 * to refuse.
 *
 * Label lookup belongs to the caller: the keys are stable identifiers from the
 * RPC, and the strings are bilingual and screen-specific.
 */

export type ImpactRow = { key: string; count: number; blocking: boolean };

export function ImpactPreview({
  items,
  loading,
  label,
  emptyLabel,
  blockedLabel,
  className,
}: {
  items: readonly ImpactRow[];
  loading?: boolean;
  /** `(key, count) => "35 enrolled students"`. */
  label: (key: string, count: number) => string;
  emptyLabel: string;
  /** Shown when any row blocks — say what the operator must do instead. */
  blockedLabel?: string;
  className?: string;
}) {
  if (loading) {
    return (
      <p className={cn("flex items-center gap-2 text-meta text-text-muted", className)}>
        <Loader2 size={14} className="animate-spin" aria-hidden />
      </p>
    );
  }

  const blocked = items.some((i) => i.blocking);

  if (items.length === 0) {
    return <p className={cn("text-meta text-text-muted", className)}>{emptyLabel}</p>;
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <ul className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((i, idx) => (
          <li
            key={i.key}
            className={cn(
              "text-meta",
              i.blocking ? "font-semibold text-danger-fg" : "text-text-secondary",
            )}
          >
            {label(i.key, i.count)}
            {idx < items.length - 1 ? <span className="ml-2 text-text-muted">·</span> : null}
          </li>
        ))}
      </ul>
      {blocked && blockedLabel ? (
        <p role="alert" className="flex items-start gap-2 rounded-lg bg-danger-bg px-3 py-2 text-meta text-danger-fg">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden />
          {blockedLabel}
        </p>
      ) : null}
    </div>
  );
}
