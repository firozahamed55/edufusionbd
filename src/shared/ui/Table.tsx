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
    <div className="overflow-x-auto rounded-2xl border border-border-default bg-surface shadow-e3">
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
    <thead className="bg-sunken text-left text-meta font-semibold text-text-muted">
      {children}
    </thead>
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
