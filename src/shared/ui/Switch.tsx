"use client";

import { useId } from "react";
import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

/**
 * The one toggle (settings audit A-1, A-2, §3.5).
 *
 * There were five hand-rolled toggles across the module and not one of them
 * announced its state. Each was a `<button>` styled as a switch with no
 * `role="switch"` and no `aria-checked`, so a screen reader said "Parent SMS
 * notifications, button" — identically in both positions. One of them
 * (`SubjectScreen`) had no accessible name at all: it sat inside a `<label>`,
 * and a `<label>` does not label a `<button>`. WCAG 4.1.2, on a product sold to
 * public institutions where accessibility procurement rules apply.
 *
 * The row is the hit target, not the 40×24 track — 2.5.8 asks for 24 px and a
 * thumb is smaller than that on every one of the old toggles.
 */
export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const labelId = useId();
  const descId = useId();
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="min-w-0 flex-1">
        <p id={labelId} className="text-body font-semibold text-text-primary">{label}</p>
        {description ? <p id={descId} className="mt-0.5 text-micro text-text-muted">{description}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={description ? descId : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          // A 44 px square around a 40×24 track: the control an operator taps on
          // a phone, rather than the graphic they can see.
          "relative inline-flex size-11 shrink-0 items-center justify-center rounded-lg",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <span
          className={cn(
            "relative inline-flex h-6 w-10 items-center rounded-full transition-colors",
            checked ? "bg-primary" : "bg-border-strong",
          )}
        >
          <span className={cn("absolute size-5 rounded-full bg-white transition-all", checked ? "right-0.5" : "left-0.5")} />
        </span>
      </button>
    </div>
  );
}
