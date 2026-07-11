"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import { useEffect, useState } from "react";
import { Bell, Search, ChevronDown, ChevronRight, ChevronUp, CalendarDays, MessageSquareText, Menu, X } from "lucide-react";
import type { ReactNode } from "react";
import {
  ADMIN_NAV_SECTIONS,
  ADMIN_NAV_FOOTER,
  type AdminNavItem,
  type AdminSubItem,
} from "./adminNav";
import { ThemeToggle, LocaleToggle } from "@/shared/ui";
import { cn } from "@/shared/lib/cn";
import { localizeDigits } from "@/shared/lib/format";
import type { Locale } from "@/shared/i18n/config";

/**
 * Sticky sidebar + sticky topbar + scrolling content — the shared admin chrome.
 * Fully token-driven, so it renders correctly in light and dark from one path.
 * Collected screens supply ONLY the content area; the shell is never duplicated.
 *
 * Responsive: at lg+ the sidebar is a permanent sticky rail. Below lg it collapses
 * into an off-canvas drawer opened by the topbar hamburger, closed by the overlay,
 * the Escape key, or navigating. A skip-to-content link and aria-current on the
 * active route keep the chrome keyboard- and screen-reader-friendly.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const locale = useLocale() as Locale;
  const [drawerOpen, setDrawerOpen] = useState(false);

  const t = (i: { bn: string; en: string }) => (locale === "bn" ? i.bn : i.en);
  const tx = (bn: string, en: string) => (locale === "bn" ? bn : en);
  const num = (v: string | number) => localizeDigits(v, locale);
  const isActive = (i: AdminNavItem) =>
    pathname.startsWith(i.match ?? `/admin/${i.key}`);
  const isSubActive = (s: AdminSubItem) => {
    const prefixes = Array.isArray(s.match) ? s.match : [s.match ?? s.href];
    return prefixes.some((p) => pathname.startsWith(p));
  };

  // Close the mobile drawer on navigation.
  useEffect(() => setDrawerOpen(false), [pathname]);

  // Close the mobile drawer on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const SubLink = ({ item }: { item: AdminSubItem }) => {
    const active = isSubActive(item);
    return (
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex h-9 items-center gap-2.5 rounded-lg px-3 text-[13px] transition-colors",
          active
            ? "bg-primary-subtle font-semibold text-text-primary"
            : "font-medium text-text-secondary hover:bg-sunken",
        )}
      >
        <span
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            active ? "bg-primary" : "bg-text-muted/70",
          )}
        />
        <span className="truncate">{t(item)}</span>
      </Link>
    );
  };

  const NavLink = ({ item }: { item: AdminNavItem }) => {
    const Icon = item.icon;
    const active = isActive(item);
    const Chevron = active ? ChevronDown : ChevronRight;
    return (
      <div className="flex flex-col gap-0.5">
        <Link
          href={item.href}
          aria-current={active && !item.sub ? "page" : undefined}
          className={cn(
            "flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
            active
              ? "bg-primary-subtle font-semibold text-primary"
              : "font-medium text-text-secondary hover:bg-sunken",
          )}
        >
          <Icon size={18} className="shrink-0" />
          <span className="truncate">{t(item)}</span>
          {item.sub ? (
            <Chevron size={15} className="ml-auto shrink-0 text-text-muted" />
          ) : null}
        </Link>
        {item.sub && active ? (
          <div className="flex flex-col gap-0.5 pb-1 pl-6">
            {item.sub.map((group, gi) => {
              if (!group.label) {
                return group.items.map((s) => <SubLink key={s.href} item={s} />);
              }
              // Labeled group (Core Settings): header row toggles like Figma —
              // only the group holding the active route is expanded.
              const open = group.items.some(isSubActive);
              const GroupChevron = open ? ChevronUp : ChevronDown;
              return (
                <div key={gi} className="flex flex-col gap-0.5">
                  <Link
                    href={group.items[0].href}
                    className="flex h-9 items-center gap-2.5 rounded-lg px-3 text-[13px] font-medium text-text-secondary hover:bg-sunken"
                  >
                    <span className="flex-1 truncate">{t(group.label)}</span>
                    <GroupChevron size={14} className="shrink-0 text-text-muted" />
                  </Link>
                  {open ? (
                    <div className="flex flex-col gap-0.5 pl-3">
                      {group.items.map((s) => (
                        <SubLink key={s.href} item={s} />
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  };

  // Sidebar content — rendered identically in the desktop rail and mobile drawer.
  const sidebarNav = (
    <nav aria-label={tx("প্রধান নেভিগেশন", "Main navigation")} className="flex flex-1 flex-col gap-1">
      <div className="flex items-center gap-2.5 px-1 pb-2 pt-0.5">
        <div className="grid size-9 place-items-center rounded-lg bg-primary text-lg font-bold text-text-on-primary">
          E
        </div>
        <div className="leading-tight">
          <p className="text-[15px] font-semibold">
            {tx("এডুফিউশনবিডি", "EduFusionBD")}
          </p>
          <p className="text-[11px] text-text-muted">{tx("অ্যাডমিন", "Admin")}</p>
        </div>
      </div>

      {ADMIN_NAV_SECTIONS.map((section, i) => (
        <div key={i} className="flex flex-col gap-1">
          {section.label ? (
            <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
              {locale === "bn" ? section.label.bn : section.label.en}
            </p>
          ) : null}
          {section.items.map((item) => (
            <NavLink key={item.key} item={item} />
          ))}
        </div>
      ))}

      <div className="flex-1" />
      <div className="h-px w-full bg-border-default" />
      <div className="flex flex-col gap-1 pt-1">
        {ADMIN_NAV_FOOTER.map((item) => (
          <NavLink key={item.key} item={item} />
        ))}
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-canvas text-text-primary">
      <a
        href="#admin-main"
        className="sr-only rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-text-on-primary focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
      >
        {tx("মূল কন্টেন্টে যান", "Skip to content")}
      </a>

      {/* Desktop sidebar (permanent rail at lg+) */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-1 overflow-y-auto border-r border-border-default bg-surface px-4 py-5 lg:flex">
        {sidebarNav}
      </aside>

      {/* Mobile drawer (below lg) */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label={tx("বন্ধ করুন", "Close menu")}
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={tx("নেভিগেশন", "Navigation")}
            className="absolute left-0 top-0 flex h-full w-72 max-w-[85vw] flex-col gap-1 overflow-y-auto border-r border-border-default bg-surface px-4 py-5 shadow-e3"
          >
            <button
              type="button"
              aria-label={tx("বন্ধ করুন", "Close menu")}
              onClick={() => setDrawerOpen(false)}
              className="absolute right-3 top-3 grid size-8 place-items-center rounded-lg text-text-secondary hover:bg-sunken"
            >
              <X size={18} />
            </button>
            {sidebarNav}
          </aside>
        </div>
      ) : null}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center gap-2.5 border-b border-border-default bg-surface px-4 sm:px-6">
          <button
            type="button"
            aria-label={tx("মেনু খুলুন", "Open menu")}
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
            className="grid size-9 shrink-0 place-items-center rounded-lg border border-border-strong text-text-secondary hover:bg-sunken lg:hidden"
          >
            <Menu size={18} />
          </button>

          <div className="flex-1" />

          <div className="hidden items-center gap-1.5 text-[13px] font-medium text-text-secondary md:flex">
            <CalendarDays size={15} />
            <span>{tx("১২ জুন, ২:৪৫ PM", "12 Jun, 2:45 PM")}</span>
          </div>
          <div className="hidden items-center gap-1.5 rounded-full bg-success-bg px-3 py-1.5 text-[13px] font-semibold text-success-fg sm:flex">
            <MessageSquareText size={15} />
            <span>{num("8,250")} SMS</span>
          </div>
          <div className="mx-1 hidden h-7 w-px bg-border-default sm:block" />
          <button
            type="button"
            aria-label={tx("অনুসন্ধান", "Search")}
            className="grid size-9 place-items-center rounded-lg border border-border-strong text-text-secondary hover:bg-sunken"
          >
            <Search size={18} />
          </button>
          <button
            type="button"
            aria-label={tx("বিজ্ঞপ্তি", "Notifications")}
            className="relative grid size-9 place-items-center rounded-lg border border-border-strong text-text-secondary hover:bg-sunken"
          >
            <Bell size={18} />
            <span className="absolute right-2 top-2 size-2 rounded-full bg-danger-fg" />
          </button>
          <ThemeToggle />
          <LocaleToggle />
          <div className="mx-1 hidden h-7 w-px bg-border-default sm:block" />
          <button
            type="button"
            className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2 hover:bg-sunken"
          >
            <span className="grid size-8 place-items-center rounded-full bg-primary text-[13px] font-semibold text-text-on-primary">
              {tx("অ্যা", "AD")}
            </span>
            <span className="hidden leading-tight sm:block">
              <span className="block text-[13px] font-semibold text-text-primary">
                {tx("অ্যাডমিন", "Admin")}
              </span>
              <span className="block text-[11px] text-text-muted">
                {tx("প্রধান শিক্ষক", "Head Teacher")}
              </span>
            </span>
            <ChevronDown size={16} className="hidden text-text-muted sm:block" />
          </button>
        </header>

        <main id="admin-main" className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
