import { Check } from "lucide-react";
import { cn } from "@/shared/lib/cn";

/**
 * Horizontal step indicator for multi-step flows (First-Login Setup wizard).
 * Progressive disclosure: shows where the user is, what is done (check), and
 * what remains. Token-driven; the connector fills as steps complete.
 */
export function Stepper({
  steps,
  current,
  className,
}: {
  steps: string[];
  current: number; // zero-based index of the active step
  className?: string;
}) {
  return (
    <ol className={cn("flex items-center gap-2", className)} aria-label="Progress">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <div className="flex items-center gap-2">
              <span
                aria-current={active ? "step" : undefined}
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold transition-colors tnum",
                  done && "bg-primary text-text-on-primary",
                  active && "bg-primary-subtle text-primary ring-2 ring-primary",
                  !done && !active && "bg-sunken text-text-muted",
                )}
              >
                {done ? <Check size={15} /> : i + 1}
              </span>
              <span
                className={cn(
                  "hidden text-meta font-medium sm:inline",
                  active ? "text-text-primary" : "text-text-muted",
                )}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 ? (
              <span
                className={cn(
                  "h-px flex-1 transition-colors",
                  done ? "bg-primary" : "bg-border-strong",
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
