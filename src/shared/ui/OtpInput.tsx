"use client";

import { useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { cn } from "@/shared/lib/cn";

/**
 * Segmented OTP input — individual digit boxes with auto-advance, backspace to
 * previous, arrow navigation, and full paste support (paste a 6-digit code into
 * any box and it fills all). Exposes the joined value via onChange.
 *
 * Accessibility: wrapped in role="group" with an aria-label; each box is a
 * single-char numeric input, so screen readers announce position and the
 * global focus-visible ring applies.
 */
export function OtpInput({
  length = 6,
  value,
  onChange,
  ariaLabel = "One-time passcode",
  disabled,
}: {
  length?: number;
  value: string;
  onChange: (next: string) => void;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  const focus = (i: number) => refs.current[i]?.focus();

  const setAt = (i: number, char: string) => {
    const next = digits.slice();
    next[i] = char;
    onChange(next.join(""));
  };

  const onKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[i]) {
        setAt(i, "");
      } else if (i > 0) {
        setAt(i - 1, "");
        focus(i - 1);
      }
    } else if (e.key === "ArrowLeft" && i > 0) {
      focus(i - 1);
    } else if (e.key === "ArrowRight" && i < length - 1) {
      focus(i + 1);
    }
  };

  const onInput = (i: number, raw: string) => {
    const char = raw.replace(/\D/g, "").slice(-1);
    if (!char) return;
    setAt(i, char);
    if (i < length - 1) focus(i + 1);
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    onChange(pasted.padEnd(0));
    focus(Math.min(pasted.length, length - 1));
  };

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="flex items-center justify-between gap-2"
    >
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          disabled={disabled}
          value={d}
          aria-label={`${ariaLabel} digit ${i + 1}`}
          onChange={(e) => onInput(i, e.target.value)}
          onKeyDown={(e) => onKey(i, e)}
          onPaste={onPaste}
          className={cn(
            "h-12 w-full min-w-0 rounded-lg border text-center text-lg font-semibold text-text-primary transition-colors focus:outline-none tnum",
            d
              ? "border-primary bg-primary-subtle"
              : "border-border-strong bg-surface",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        />
      ))}
    </div>
  );
}
