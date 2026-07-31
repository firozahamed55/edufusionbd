"use client";

import { createContext, useContext, useId } from "react";
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
 *   • card   → rounded-2xl (16px) border border-border-default bg-surface p-4.5 shadow-e1, gap-14
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
        "flex flex-col gap-3.5 rounded-2xl border border-border-default bg-surface p-4.5 shadow-e1",
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

/**
 * A labelled form field.
 *
 * `error` is the whole point of the audit fix (A-7): `Field` had `label`,
 * `required` and `hint` but no way to express a validation failure, so `zod`
 * was a dependency used on 3 of 56 screens and errors had nowhere to live.
 * The message renders with `role="alert"` and is wired to the control via
 * `aria-describedby`, so a screen reader announces it rather than leaving a
 * sighted-only red outline.
 *
 * `onBlur` lives here rather than on each control because React's synthetic
 * blur is `focusout`, which DOES bubble — so the wrapping `<label>` sees a blur
 * from whatever it contains. That means marking a field touched for
 * `useZodForm` is one spread on the `Field` (`{...bind("dob")}`) instead of a
 * hand-wired handler on every `Input`, `Select` and `Textarea` in the product.
 */
export function Field({
  label,
  required,
  hint,
  error,
  className,
  onBlur,
  children,
}: {
  label?: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  error?: string;
  className?: string;
  /** Fires when focus leaves any control inside. See the note above. */
  onBlur?: () => void;
  children: ReactNode;
}) {
  const errorId = useId();
  return (
    <label onBlur={onBlur} className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      {label ? (
        <span className="text-meta font-medium text-text-secondary">
          {label}
          {required ? <span className="text-danger-fg"> *</span> : null}
        </span>
      ) : null}
      <FieldErrorContext.Provider value={error ? errorId : undefined}>
        {children}
      </FieldErrorContext.Provider>
      {error ? (
        <span id={errorId} role="alert" className="text-xs font-medium text-danger-fg">
          {error}
        </span>
      ) : hint ? (
        <span className="text-xs text-text-muted">{hint}</span>
      ) : null}
    </label>
  );
}

/**
 * Lets `Input`/`Select`/`Textarea` pick up `aria-invalid` + `aria-describedby`
 * from the enclosing `Field` without every screen threading both props by hand
 * — the reason the old primitive had no error state is that doing it manually
 * at ~200 call sites was never going to happen.
 */
const FieldErrorContext = createContext<string | undefined>(undefined);

function useFieldError() {
  const id = useContext(FieldErrorContext);
  return id ? { "aria-invalid": true as const, "aria-describedby": id } : {};
}

const controlBase =
  "h-10.5 w-full rounded-lg border border-border-control bg-surface px-3 text-sm text-text-primary placeholder:text-text-muted transition-colors focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:bg-sunken disabled:text-text-muted aria-invalid:border-danger-solid";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  const invalid = useFieldError();
  return <input className={cn(controlBase, className)} {...invalid} {...props} />;
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
  const invalid = useFieldError();
  return (
    <div className="relative">
      <select className={cn(controlBase, "appearance-none pr-9", className)} {...invalid} {...props}>
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
  const invalid = useFieldError();
  return (
    <textarea
      className={cn(
        "min-h-23 w-full rounded-lg border border-border-control bg-surface p-3 text-sm text-text-primary placeholder:text-text-muted transition-colors focus:border-primary focus:outline-none aria-invalid:border-danger-solid",
        className,
      )}
      {...invalid}
      {...props}
    />
  );
}

/**
 * Sticky bottom action bar — full-bleed within the AdminShell <main>, pinned to
 * the viewport bottom while content scrolls above it.
 *
 * The bleed reads `--shell-pad` (set by AdminShell) rather than hardcoding a
 * mirror of the shell's own `p-4 sm:p-6 lg:p-8` (audit S-5): the old negative
 * margins silently broke every save bar in the app the moment shell padding
 * changed, with nothing to catch it.
 */
export function SaveBar({
  status,
  children,
}: {
  status?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className="sticky bottom-0 z-[var(--z-savebar)] mt-2 border-t border-border-default bg-surface/90 py-3.5 backdrop-blur"
      style={{
        marginInline: "calc(-1 * var(--shell-pad))",
        marginBottom: "calc(-1 * var(--shell-pad))",
        paddingInline: "var(--shell-pad)",
      }}
    >
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
 *
 * `indeterminate` is a DOM property with no HTML attribute, so it can only be
 * set imperatively — which is why partial selection used to render identically
 * to no selection on every select-all in the app (audit A-8).
 */
export function Checkbox({
  className,
  indeterminate,
  ...props
}: ComponentPropsWithRef<"input"> & { indeterminate?: boolean }) {
  return (
    <input
      type="checkbox"
      ref={(el) => {
        if (el) el.indeterminate = Boolean(indeterminate);
      }}
      className={cn(
        "size-4 shrink-0 cursor-pointer rounded border border-border-control bg-surface align-middle accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
