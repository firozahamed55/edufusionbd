"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/shared/lib/cn";

/**
 * Password field with a show/hide affordance (Figma login eye icon).
 * Reuses the shared control styling; the toggle is an icon-button with an
 * aria-label so it is announced and keyboard-operable. Token-driven → themes.
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
  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={cn(
          "h-10.5 w-full rounded-lg border border-border-strong bg-surface px-3 pr-10 text-sm text-text-primary placeholder:text-text-muted transition-colors focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:bg-sunken",
          className,
        )}
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
