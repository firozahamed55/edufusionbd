import { ChevronDown } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import type {
  ReactNode,
  ComponentPropsWithRef,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

/**
 * Centralized form primitives — the single source of truth for the EduFusionBD
 * "form" archetype, matched 1:1 to the Figma product file:
 *   • card   → rounded-2xl (16px) bg-surface p-4.5 shadow-e3, gap-14
 *   • field  → label 13px/medium/text-secondary, gap-6 to control
 *   • control→ h-42 px-3 rounded-lg border-border-strong
 * Every value is a semantic token, so all of it themes correctly in light & dark.
 */

export function FormCard({
  title,
  action,
  className,
  children,
}: {
  title?: ReactNode;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-3.5 rounded-2xl bg-surface p-4.5 shadow-e3",
        className,
      )}
    >
      {title ? (
        <div className="flex items-center gap-2">
          <h2 className="flex-1 text-base font-semibold text-text-primary">{title}</h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Field({
  label,
  required,
  hint,
  className,
  children,
}: {
  label?: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      {label ? (
        <span className="text-meta font-medium text-text-secondary">
          {label}
          {required ? <span className="text-danger-fg"> *</span> : null}
        </span>
      ) : null}
      {children}
      {hint ? <span className="text-xs text-text-muted">{hint}</span> : null}
    </label>
  );
}

const controlBase =
  "h-10.5 w-full rounded-lg border border-border-control bg-surface px-3 text-sm text-text-primary placeholder:text-text-muted transition-colors focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:bg-sunken disabled:text-text-muted";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlBase, className)} {...props} />;
}

type Option = { value: string; label: string };

export function Select({
  options,
  placeholder,
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  options: Option[];
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <select className={cn(controlBase, "appearance-none pr-9", className)} {...props}>
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={16}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
      />
    </div>
  );
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-23 w-full rounded-lg border border-border-control bg-surface p-3 text-sm text-text-primary placeholder:text-text-muted transition-colors focus:border-primary focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Sticky bottom action bar — full-bleed within the AdminShell <main> (p-8),
 * pinned to the viewport bottom while content scrolls above it. Matches the
 * Figma "unsaved changes + actions" save bar.
 */
export function SaveBar({
  status,
  children,
}: {
  status?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="sticky bottom-0 z-20 -mx-4 -mb-4 mt-2 border-t border-border-default bg-surface/90 px-4 py-3.5 backdrop-blur sm:-mx-6 sm:-mb-6 sm:px-6 lg:-mx-8 lg:-mb-8 lg:px-8">
      <div className="flex items-center gap-3">
        {status ? (
          <div className="flex flex-1 items-center gap-2 text-meta text-text-muted">
            {status}
          </div>
        ) : (
          <div className="flex-1" />
        )}
        <div className="flex items-center gap-2.5">{children}</div>
      </div>
    </div>
  );
}

/** Small amber "unsaved" dot used in SaveBar status. */
export function UnsavedDot() {
  return <span className="size-2 shrink-0 rounded-full bg-warning-fg" />;
}

/**
 * Design-system checkbox — brand-indigo `accent-color` (themes automatically in
 * light/dark via the interactive-primary token), 16px, accessible focus ring.
 * Used for row-selection ("Selection Box") columns and boolean fields.
 */
export function Checkbox({
  className,
  ...props
}: ComponentPropsWithRef<"input">) {
  return (
    <input
      type="checkbox"
      className={cn(
        "size-4 shrink-0 cursor-pointer rounded border border-border-control bg-surface align-middle accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
