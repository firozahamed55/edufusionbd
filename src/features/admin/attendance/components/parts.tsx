import { cn } from "@/shared/lib/cn";

/**
 * Shared attendance UI parts — status selector pills, SMS toggle, summary dots
 * and the per-column filter input. Reused by Section, Exam and Update screens
 * so the marking UI is identical everywhere. Active pills use the exact Figma
 * saturated colors (green-600 / red-600 / amber-600 / violet-700); inactive use
 * the tinted status token so they theme in light & dark.
 */

const solidTone = {
  success: "bg-green-600 text-white",
  danger: "bg-red-600 text-white",
  warning: "bg-amber-600 text-white",
  exam: "bg-violet-700 text-white",
  leave: "bg-sky-600 text-white",
} as const;

const tintTone = {
  success: "bg-success-bg text-success-fg",
  danger: "bg-danger-bg text-danger-fg",
  warning: "bg-warning-bg text-warning-fg",
  exam: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  leave: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
} as const;

export type AttTone = keyof typeof solidTone;

export function StatusPill({
  tone,
  label,
  active,
}: {
  tone: AttTone;
  label: string;
  active: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-meta font-semibold transition-colors",
        active ? solidTone[tone] : cn(tintTone[tone], "hover:brightness-95"),
      )}
    >
      <span className={cn("size-1.5 rounded-full", active ? "bg-white" : "bg-current")} />
      {label}
    </button>
  );
}

export function SummaryDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-2 rounded-full", color)} />
      {label}
    </span>
  );
}

export function Toggle({ on }: { on?: boolean }) {
  return (
    <span className={cn("relative inline-flex h-5 w-9 items-center rounded-full", on ? "bg-success-fg" : "bg-border-strong")}>
      <span className={cn("absolute size-4 rounded-full bg-white", on ? "right-0.5" : "left-0.5")} />
    </span>
  );
}

export function AttColFilter({ className, placeholder }: { className?: string; placeholder?: string }) {
  return (
    <div className={className}>
      <input
        placeholder={placeholder}
        className="h-8 w-full rounded-md border border-border-strong bg-surface px-2 text-xs text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none"
      />
    </div>
  );
}
