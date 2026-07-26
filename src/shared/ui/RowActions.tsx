"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { MoreVertical } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useFocusTrap } from "./Dialog";
import type { LucideIcon } from "lucide-react";

export type RowAction = {
  label: string;
  icon?: LucideIcon;
  href?: string;
  onClick?: () => void;
  tone?: "default" | "danger";
  disabled?: boolean;
};

/**
 * Per-row kebab menu (audit W-7 — the `MoreVertical` button rendered on every
 * row of the teacher list with no handler at all).
 *
 * Keyboard-operable and focus-trapped via the same utility the modal uses, so
 * it is not another unmanaged overlay (T-7).
 */
export function RowActions({ actions, label }: { actions: RowAction[]; label: string }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open, () => setOpen(false), { lockScroll: false });

  if (actions.length === 0) return null;

  return (
    <div className="relative inline-block">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="grid size-8 place-items-center rounded-md text-text-muted hover:bg-sunken hover:text-text-primary"
      >
        <MoreVertical size={18} />
      </button>
      {open ? (
        <>
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div
            ref={panelRef}
            role="menu"
            tabIndex={-1}
            className="absolute right-0 top-full z-50 mt-1 w-44 rounded-lg border border-border-default bg-surface py-1 text-left shadow-e3 focus:outline-none"
          >
            {actions.map((a) => {
              const cls = cn(
                "flex w-full items-center gap-2.5 px-3 py-2 text-meta font-medium hover:bg-sunken disabled:opacity-50",
                a.tone === "danger" ? "text-danger-fg" : "text-text-primary",
              );
              const body = (
                <>
                  {a.icon ? <a.icon size={15} className="shrink-0" /> : null}
                  {a.label}
                </>
              );
              return a.href ? (
                <Link key={a.label} href={a.href} role="menuitem" className={cls} onClick={() => setOpen(false)}>
                  {body}
                </Link>
              ) : (
                <button
                  key={a.label}
                  type="button"
                  role="menuitem"
                  disabled={a.disabled}
                  onClick={() => {
                    setOpen(false);
                    a.onClick?.();
                  }}
                  className={cls}
                >
                  {body}
                </button>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
