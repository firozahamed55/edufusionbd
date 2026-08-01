import { Loader2, AlertCircle, Lock } from "lucide-react";
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
        <p className="text-body font-semibold text-text-primary">{title}</p>
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
        <p className="text-body font-semibold text-text-primary">{title}</p>
        {description ? (
          <p className="mx-auto max-w-sm text-sm text-text-muted">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

/**
 * "You do not have access", as distinct from "there is nothing here".
 *
 * Settings audit M-4. The database gates `profile` and `user_role` on
 * `core.user_manage` and `audit_log` on `audit.read`, while the navigation rail
 * gates all eleven Settings screens on `core.settings` alone. So an operator
 * holding only `core.settings` could open Users & Roles and see an empty
 * table — RLS working exactly as designed, and indistinguishable from a school
 * that has not added anyone yet.
 *
 * An empty state in that position is worse than a refusal: it reads as a bug,
 * it gets reported as one, and the person answering the ticket has to work out
 * that the product was correct. Say so instead.
 *
 * The `permission` code is shown deliberately. Whoever the operator asks for
 * access needs to know what to grant, and it is not a secret — it is printed in
 * the permission matrix.
 */
export function NoAccessState({
  title,
  description,
  permission,
  action,
  className,
}: {
  title: string;
  description?: string;
  permission?: string;
  /** Usually a "request access" link — see `SettingsGate` for the mailto. */
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-border-strong bg-sunken px-6 py-14 text-center",
        className,
      )}
    >
      <span className="grid size-12 place-items-center rounded-2xl bg-surface text-text-muted">
        <Lock size={22} aria-hidden />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-body font-semibold text-text-primary">{title}</p>
        {description ? (
          <p className="mx-auto max-w-sm text-sm text-text-muted">{description}</p>
        ) : null}
        {permission ? (
          <p className="mx-auto mt-1 font-latin text-micro text-text-muted">{permission}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
