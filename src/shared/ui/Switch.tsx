"use client";

import { useId } from "react";
import { cn } from "@/shared/lib/cn";
import type { ReactNode } from "react";

/**
 * A toggle a screen reader can read and a thumb can hit (audit A-1, A-2, M-9).
 *
 * WHAT WAS THERE. Five hand-rolled toggles: a `<button>` with a coloured pill
 * and a sliding dot, no `role`, no `aria-checked`. A screen reader announced
 * "Parent SMS notifications, button" — identical in both positions, so the one
 * thing the control communicates was the one thing it did not say. The Subject
 * modal's was worse: wrapped in a `<label>`, which does not label a `<button>`,
 * so it announced as "button" with no name at all. Both are 4.1.2 Name, Role,
 * Value failures on a product sold to public institutions, where accessibility
 * is a procurement question.
 *
 * WHY A BUTTON AND NOT `<input type="checkbox" role="switch">`. Either is
 * conformant. A button carries no implicit form semantics to fight, has no
 * indeterminate state to explain, and matches how every call site already
 * behaves — none of these five is inside a `<form>` and none is submitted; they
 * fire a mutation. The checkbox version's advantage is autofill and form
 * serialisation, neither of which applies.
 *
 * THE HIT TARGET IS THE WHOLE ROW, NOT THE PILL. WCAG 2.5.8 asks for 24×24 CSS
 * pixels and 2.5.5 (AAA) for 44×44; the pill is 40×24. Rather than inflate the
 * pill — which would look wrong next to the visual language of the rest of the
 * module — the button is padded to a 44px-tall target with the pill drawn
 * inside it. An operator on a phone in a school office hits the row.
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
  /**
   * The accessible name. Required — the whole class of defect this replaces is
   * a toggle with no name, so there is no prop shape here that permits one.
   */
  label: ReactNode;
  /** Optional supporting line, associated via `aria-describedby`. */
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const labelId = useId();
  const descId = useId();

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="min-w-0 flex-1">
        <span id={labelId} className="block text-sm font-semibold text-text-primary">
          {label}
        </span>
        {description ? (
          <span id={descId} className="mt-0.5 block text-meta text-text-muted">
            {description}
          </span>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={description ? descId : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        /* grid+place-items centres the pill inside the 44px target so the
           control still reads as a 40×24 switch while being twice that to
           press. `shrink-0` because the label column is the flexible one. */
        className={cn(
          "grid size-11 shrink-0 place-items-center rounded-lg transition-colors",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          disabled ? "cursor-not-allowed opacity-50" : "hover:bg-sunken",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "relative inline-flex h-6 w-10 items-center rounded-full transition-colors",
            checked ? "bg-primary" : "bg-border-strong",
          )}
        >
          <span
            className={cn(
              "absolute size-5 rounded-full bg-surface shadow-e1 transition-all",
              checked ? "right-0.5" : "left-0.5",
            )}
          />
        </span>
      </button>
    </div>
  );
}
