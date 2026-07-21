import { cn } from "@/shared/lib/cn";
import type { ReactNode } from "react";

/**
 * Lightweight, accessible charts — replace the "fake" hardcoded-pixel bars and
 * fixed-percent donut. Each chart is a <figure> with role="img" + an aria-label,
 * and ships a visually-hidden data table so screen-reader users and anyone who
 * needs the raw numbers get a real alternative (WCAG 1.1.1). No chart library.
 */

export type BarDatum = {
  label: string;
  value: number;
  /** Pre-formatted (e.g. localized) value shown above the bar; falls back to `value`. */
  display?: ReactNode;
};

export function BarChart({
  data,
  max,
  unit = "",
  caption,
  className,
}: {
  data: BarDatum[];
  max?: number;
  unit?: string;
  caption?: string;
  className?: string;
}) {
  const ceiling = max ?? Math.max(...data.map((d) => d.value), 1);
  return (
    <figure className={cn("m-0 flex flex-col gap-2.5", className)}>
      <div
        className="flex items-end justify-between gap-2.5"
        role="img"
        aria-label={caption ?? "Bar chart"}
      >
        {data.map((d) => (
          <div key={d.label} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex h-40 w-full items-end justify-center rounded-lg bg-sunken/60">
              <div
                className="flex w-full max-w-12 flex-col items-center justify-end"
                style={{ height: `${Math.max(6, (d.value / ceiling) * 100)}%` }}
              >
                <span className="mb-1 text-micro font-semibold text-text-secondary">
                  {d.display ?? d.value}
                  {unit}
                </span>
                <div className="w-full flex-1 rounded-t-md bg-primary/80" />
              </div>
            </div>
            <span className="text-xs text-text-muted">{d.label}</span>
          </div>
        ))}
      </div>
      <ChartTable caption={caption} data={data} unit={unit} />
    </figure>
  );
}

export function Donut({
  percent,
  valueLabel,
  label,
  caption,
  size = 160,
  thickness = 18,
  className,
}: {
  percent: number;
  /** Pre-formatted center text; falls back to `${percent}%`. */
  valueLabel?: ReactNode;
  label?: string;
  caption?: string;
  size?: number;
  thickness?: number;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const filled = (clamped / 100) * c;
  return (
    <figure
      className={cn("relative m-0", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={caption ?? `${clamped}%`}
    >
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="-rotate-90">
        <title>{caption ?? `${clamped}%`}</title>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={thickness} className="stroke-sunken" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={thickness}
          strokeLinecap="round"
          className="stroke-primary"
          strokeDasharray={`${filled} ${c - filled}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-stat font-bold text-text-primary tnum">
          {valueLabel ?? `${clamped}%`}
        </span>
        {label ? <span className="text-xs text-text-muted">{label}</span> : null}
      </div>
    </figure>
  );
}

/** Visually-hidden real table — the non-visual data alternative for both charts. */
function ChartTable({
  caption,
  data,
  unit,
}: {
  caption?: string;
  data: BarDatum[];
  unit: string;
}) {
  return (
    <table className="sr-only">
      {caption ? <caption>{caption}</caption> : null}
      <tbody>
        {data.map((d) => (
          <tr key={d.label}>
            <th scope="row">{d.label}</th>
            <td>
              {d.value}
              {unit}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
