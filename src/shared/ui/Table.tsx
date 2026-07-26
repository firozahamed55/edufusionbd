"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import type {
  ReactNode,
  ThHTMLAttributes,
  TdHTMLAttributes,
  HTMLAttributes,
} from "react";

/**
 * Accessible table primitive — replaces the `<div>`-grid "tables" that lacked
 * `<th scope>` (WCAG 1.3.1 fail) and broke responsively at fixed pixel widths.
 * Real semantic <table> inside an `overflow-x-auto` card, so it stays a proper
 * data table for screen readers AND scrolls instead of overflowing on narrow
 * viewports. Compose with THead/TBody/TR/TH/TD; use TableEmpty for the zero state.
 */
export function Table({
  minWidth = 640,
  className,
  children,
}: {
  /** Min width before the container scrolls horizontally. */
  minWidth?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    // max-h + sticky thead: column labels survive scrolling a long result
    // sheet (audit R-3). The cap is generous so short tables never scroll.
    <div className="max-h-[70vh] overflow-auto rounded-2xl border border-border-default bg-surface shadow-e1">
      <table
        className={cn("w-full border-collapse text-sm", className)}
        style={{ minWidth }}
      >
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="sticky top-0 z-[1] bg-sunken text-left text-meta font-semibold text-text-muted">
      {children}
    </thead>
  );
}

export type SortDir = "asc" | "desc";
export type Sort = { key: string; dir: SortDir } | null;

/**
 * Sortable column header (audit W-6 — no table in the product could be sorted
 * by any column). Toggles asc → desc → unsorted, and reports `aria-sort` so
 * the state is available to assistive tech, not just visually.
 */
export function SortableTH({
  sortKey,
  sort,
  onSort,
  className,
  children,
}: {
  sortKey: string;
  sort: Sort;
  onSort: (next: Sort) => void;
  className?: string;
  children: ReactNode;
}) {
  const active = sort?.key === sortKey ? sort.dir : null;
  const Icon = active === "asc" ? ArrowUp : active === "desc" ? ArrowDown : ChevronsUpDown;
  return (
    <th
      scope="col"
      aria-sort={active === "asc" ? "ascending" : active === "desc" ? "descending" : "none"}
      className={cn("px-5 py-3 font-semibold", className)}
    >
      <button
        type="button"
        onClick={() =>
          onSort(active === "asc" ? { key: sortKey, dir: "desc" } : active === "desc" ? null : { key: sortKey, dir: "asc" })
        }
        className="flex items-center gap-1.5 rounded font-semibold hover:text-text-primary"
      >
        {children}
        <Icon size={13} className={cn("shrink-0", active ? "text-primary" : "text-text-decorative")} />
      </button>
    </th>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function TR({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn("border-b border-border-default last:border-b-0", className)}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TH({
  className,
  children,
  scope = "col",
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th scope={scope} className={cn("px-5 py-3 font-semibold", className)} {...props}>
      {children}
    </th>
  );
}

export function TD({
  className,
  children,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn("px-5 py-3 align-middle text-text-primary", className)} {...props}>
      {children}
    </td>
  );
}

/** Zero-state row spanning the whole table. */
export function TableEmpty({
  colSpan,
  icon,
  title,
  description,
}: {
  colSpan: number;
  icon?: ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-5 py-14 text-center">
        <div className="mx-auto flex max-w-xs flex-col items-center gap-2">
          {icon ? <span className="text-text-muted/70">{icon}</span> : null}
          <p className="text-sm font-semibold text-text-secondary">{title}</p>
          {description ? <p className="text-xs text-text-muted">{description}</p> : null}
        </div>
      </td>
    </tr>
  );
}
