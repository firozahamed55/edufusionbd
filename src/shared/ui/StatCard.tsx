import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import type { ReactNode } from "react";

type Trend = "up" | "down" | "flat";

const trendMeta: Record<Trend, { cls: string; Icon: typeof ArrowUpRight }> = {
  up: { cls: "text-success-fg", Icon: ArrowUpRight },
  down: { cls: "text-danger-fg", Icon: ArrowDownRight },
  flat: { cls: "text-text-muted", Icon: Minus },
};

/** KPI / stat tile. Token-driven surface + border → theme-safe. */
export function StatCard({
  label,
  value,
  delta,
  trend = "up",
  icon,
  className,
}: {
  label: string;
  value: ReactNode;
  delta?: string;
  /** Direction of `delta` — drives colour + arrow. A −12% drop must not read green. */
  trend?: Trend;
  icon?: ReactNode;
  className?: string;
}) {
  const { cls, Icon } = trendMeta[trend];
  return (
    <div
      className={cn(
        "rounded-lg border border-border-default bg-surface p-5 shadow-e1",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-secondary">{label}</span>
        {icon ? <span className="text-text-muted">{icon}</span> : null}
      </div>
      <div className="mt-2 text-3xl font-bold text-text-primary tnum">{value}</div>
      {delta ? (
        <div className={cn("mt-1 flex items-center gap-1 text-sm", cls)}>
          <Icon size={15} aria-hidden />
          <span>{delta}</span>
        </div>
      ) : null}
    </div>
  );
}
