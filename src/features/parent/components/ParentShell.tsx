"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import type { ReactNode } from "react";
import { useT } from "@/shared/i18n/useT";
import { cn } from "@/shared/lib/cn";
import { ChildProvider, useActiveChild } from "../state";
import { getGuardianName } from "../data";
import { PARENT_NAV } from "./parentNav";
import { ChildSwitcher } from "./ChildSwitcher";

/**
 * Parent app chrome — a mobile-first single column (max 460px, centered on
 * larger viewports so it never stretches). Sticky greeting header + child
 * switcher on top, fixed 5-item bottom tab bar, scrolling content between.
 * Fully token-driven → correct in light & dark; every string is bilingual.
 */
export function ParentShell({ children }: { children: ReactNode }) {
  return (
    <ChildProvider>
      <ParentShellInner>{children}</ParentShellInner>
    </ChildProvider>
  );
}

function greetingKey(): "morning" | "afternoon" | "evening" {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

function ParentShellInner({ children }: { children: ReactNode }) {
  const { t } = useT();
  const pathname = usePathname();
  const { active } = useActiveChild();
  const guardian = getGuardianName();

  const greeting = {
    morning: t("শুভ সকাল", "Good morning"),
    afternoon: t("শুভ অপরাহ্ন", "Good afternoon"),
    evening: t("শুভ সন্ধ্যা", "Good evening"),
  }[greetingKey()];

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[460px] flex-col bg-canvas text-text-primary">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border-default bg-canvas/90 px-5 pb-3 pt-5 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-meta text-text-muted">{greeting} 👋</p>
            <h1 className="truncate text-xl font-bold">{t(guardian.bn, guardian.en)}</h1>
          </div>
          <div className="flex items-center gap-2.5">
            <Link
              href="/parent/notices"
              aria-label={t("নোটিশ", "Notices")}
              className="relative grid size-10 place-items-center rounded-full border border-border-default text-text-secondary transition-colors hover:bg-sunken"
            >
              <Bell size={19} />
              <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-danger-fg ring-2 ring-canvas" />
            </Link>
            <Link
              href="/parent/profile"
              aria-label={t("প্রোফাইল", "Profile")}
              className="grid size-10 place-items-center rounded-full bg-primary-subtle text-sm font-bold text-primary"
            >
              {t(active.initial.bn, active.initial.en)}
            </Link>
          </div>
        </div>
        <ChildSwitcher className="mt-3.5" />
      </header>

      {/* Content */}
      <main className="flex-1 px-5 pb-28 pt-4">{children}</main>

      {/* Bottom tab bar */}
      <nav
        aria-label={t("প্রধান মেনু", "Primary")}
        className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[460px] border-t border-border-default bg-surface/95 backdrop-blur"
      >
        <ul className="grid grid-cols-4">
          {PARENT_NAV.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/parent"
                ? pathname === "/parent"
                : pathname.startsWith(item.href);
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2.5 text-micro font-medium transition-colors",
                    active ? "text-primary" : "text-text-muted hover:text-text-secondary",
                  )}
                >
                  <Icon size={22} strokeWidth={active ? 2.4 : 2} />
                  {t(item.bn, item.en)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
