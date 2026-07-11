import { cn } from "@/shared/lib/cn";
import type { ReactNode } from "react";

export type BadgeTone =
  | "neutral"
  | "primary"
  | "info"
  | "success"
  | "warning"
  | "danger";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-sunken text-text-muted",
  primary: "bg-primary-subtle text-primary",
  info: "bg-info-bg text-info-fg",
  success: "bg-success-bg text-success-fg",
  warning: "bg-warning-bg text-warning-fg",
  danger: "bg-danger-bg text-danger-fg",
};

/**
 * Status pill — the single primitive for the ad-hoc `rounded-full px-2.5 py-1`
 * chips scattered across list/table screens. Token-driven → correct in both themes.
 * A `dot` gives a non-colour cue so status never depends on colour alone (WCAG 1.4.1).
 */
export function Badge({
  tone = "neutral",
  dot,
  className,
  children,
}: {
  tone?: BadgeTone;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        tones[tone],
        className,
      )}
    >
      {dot ? <span className="size-1.5 rounded-full bg-current opacity-80" aria-hidden /> : null}
      {children}
    </span>
  );
}
