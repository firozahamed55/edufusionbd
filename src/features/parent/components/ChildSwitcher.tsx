"use client";

import { useT } from "@/shared/i18n/useT";
import { cn } from "@/shared/lib/cn";
import { useActiveChild } from "../state";

/**
 * Multi-child switcher pills (Figma). Each guardian's children render as
 * selectable pills; the active one is filled indigo, the rest are outlined.
 * A single child collapses to a static label (no switcher noise).
 */
export function ChildSwitcher({ className }: { className?: string }) {
  const { t } = useT();
  const { children, activeId, setActiveId } = useActiveChild();

  if (children.length < 2) return null;

  return (
    <div
      role="tablist"
      aria-label={t("সন্তান নির্বাচন", "Select child")}
      className={cn("flex gap-2 overflow-x-auto pb-1", className)}
    >
      {children.map((c) => {
        const active = c.id === activeId;
        return (
          <button
            key={c.id}
            role="tab"
            aria-selected={active}
            onClick={() => setActiveId(c.id)}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-full border px-2 py-1 pr-3.5 text-sm font-semibold transition-colors",
              active
                ? "border-primary bg-primary text-text-on-primary"
                : "border-border-strong bg-surface text-text-secondary hover:bg-sunken",
            )}
          >
            <span
              className={cn(
                "grid size-6 place-items-center rounded-full text-xs",
                active ? "bg-white/20 text-text-on-primary" : "bg-primary-subtle text-primary",
              )}
            >
              {t(c.initial.bn, c.initial.en)}
            </span>
            {t(c.name.bn, c.name.en)}
          </button>
        );
      })}
    </div>
  );
}
