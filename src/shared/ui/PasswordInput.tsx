"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { controlBase, useFieldError } from "./Form";

/**
 * Password field with a show/hide affordance (Figma login eye icon). The toggle
 * is an icon-button with an aria-label so it is announced and keyboard-operable.
 *
 * The input itself is `controlBase` — the same string `Input`, `Select` and
 * `Textarea` use — rather than the hand-rolled near-copy it was. That copy had
 * drifted in two ways that mattered, and both were invisible until a `Field`
 * was wrapped around it:
 *
 *   • It never consumed `FieldErrorContext`, so `<Field error="…">` around a
 *     password rendered the message with nothing tying it to the control. A
 *     screen-reader user heard an alert about a field it could not identify —
 *     on /reset-password and /change-password, which are three password fields
 *     deep and where naming the field is the entire point.
 *   • It bordered with `border-border-strong`, the DECORATIVE token, which does
 *     not meet the 3:1 an interactive boundary owes under SC 1.4.11. The login
 *     screen's identifier input had already been moved off it for exactly this
 *     reason; the password beside it had not.
 */
export function PasswordInput({
  className,
  showLabel = "Show password",
  hideLabel = "Hide password",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  showLabel?: string;
  hideLabel?: string;
}) {
  const [visible, setVisible] = useState(false);
  const invalid = useFieldError();
  return (
    <div className="relative">
      <input
        {...invalid}
        {...props}
        type={visible ? "text" : "password"}
        className={cn(controlBase, "pr-10", className)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? hideLabel : showLabel}
        aria-pressed={visible}
        className="absolute right-2.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-text-muted transition-colors hover:bg-sunken hover:text-text-secondary"
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}
