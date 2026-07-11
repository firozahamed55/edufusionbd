import { Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import type { ReactNode } from "react";

/**
 * The states an operator actually spends time in — loading, empty, error.
 * All token-driven and animation respects the global `prefers-reduced-motion` rule.
 */

/** Shimmer placeholder. Size it with utility classes (height, width, radius). */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      className={cn("block animate-pulse rounded-md bg-sunken", className)}
      aria-hidden
    />
  );
}

/** Inline spinner for buttons and small async regions. */
export function Spinner({
  size = 18,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Loader2 size={size} className={cn("animate-spin text-primary", className)} aria-hidden />
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border-strong bg-surface px-6 py-14 text-center",
        className,
      )}
    >
      {icon ? (
        <span className="grid size-12 place-items-center rounded-2xl bg-sunken text-text-muted">
          {icon}
        </span>
      ) : null}
      <div className="flex flex-col gap-1">
        <p className="text-[15px] font-semibold text-text-primary">{title}</p>
        {description ? (
          <p className="mx-auto max-w-sm text-sm text-text-muted">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  action,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-danger-fg/30 bg-danger-bg/40 px-6 py-12 text-center",
        className,
      )}
    >
      <span className="grid size-12 place-items-center rounded-2xl bg-danger-bg text-danger-fg">
        <AlertCircle size={22} aria-hidden />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-[15px] font-semibold text-text-primary">{title}</p>
        {description ? (
          <p className="mx-auto max-w-sm text-sm text-text-muted">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
