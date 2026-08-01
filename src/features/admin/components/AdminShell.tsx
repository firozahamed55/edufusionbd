"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Menu,
  X,
  LogOut,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  User,
  Keyboard,
  LifeBuoy,
  ShieldCheck,
} from "lucide-react";
import type { ReactNode } from "react";
import { createClient } from "@/shared/services/supabase/client";
import { ADMIN_NAV_ZONES, ADMIN_SETTINGS_MODULE, ADMIN_ALL_MODULES, canSeeModule, type AdminModule } from "./adminNav";
import { ROLE_LABELS, type Role } from "@/shared/constants/roles";
import { useMyPermissions } from "../core/logic/hooks";
import { resolveActiveModule, resolveActiveTab } from "./resolveNav";
import { useRailState } from "./useRailState";
import { useAdminUser } from "./useAdminUser";
import { AcademicYearSelector, ArchivedYearBanner } from "./AcademicYearSelector";
import { AcademicYearProvider } from "@/shared/services/academicYear/context";
import { ThemeToggle, LocaleToggle, useFocusTrap, OfflineBanner } from "@/shared/ui";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { CommandPalette } from "@/features/admin/core/components/CommandPalette";
import { IdleTimeout } from "./IdleTimeout";

type Tb = (b: { bn: string; en: string }) => string;

/**
 * Module-scope, NOT declared inside AdminShell.
 *
 * Declared inside the component it was re-created on every render, so React saw
 * a brand-new element type each time and tore down + remounted the entire
 * sidebar subtree on every navigation and every menu toggle.
 */
function RailLink({
  mod,
  active,
  collapsed,
  pinned,
  onTogglePin,
  t,
}: {
  mod: AdminModule;
  active: boolean;
  collapsed: boolean;
  pinned: boolean;
  onTogglePin: (key: string) => void;
  t: Tb;
}) {
  const Icon = mod.icon;
  return (
    <div className="group/rail relative flex items-center">
      <Link
        href={mod.href}
        aria-current={active ? "page" : undefined}
        title={collapsed ? t(mod) : undefined}
        className={cn(
          "flex h-10 flex-1 items-center gap-3 rounded-lg text-sm transition-colors",
          collapsed ? "justify-center px-0" : "px-3",
          active
            ? "bg-primary-subtle font-semibold text-primary"
            : "font-medium text-text-secondary hover:bg-sunken",
          mod.accent && !active && "text-accent",
        )}
      >
        <Icon size={18} className="shrink-0" />
        {collapsed ? <span className="sr-only">{t(mod)}</span> : <span className="truncate">{t(mod)}</span>}
      </Link>
      {!collapsed ? (
        <button
          type="button"
          onClick={() => onTogglePin(mod.key)}
          aria-label={pinned ? "Unpin" : "Pin"}
          aria-pressed={pinned}
          className={cn(
            "absolute right-1 grid size-7 place-items-center rounded-md text-text-decorative transition-opacity hover:bg-sunken hover:text-text-secondary focus-visible:opacity-100",
            pinned ? "opacity-100 text-primary" : "opacity-0 group-hover/rail:opacity-100",
          )}
        >
          <Pin size={13} />
        </button>
      ) : null}
    </div>
  );
}

/** Bangla label for the acting role; an unknown role falls back to its code. */
const roleLabel = (role: Role) => ROLE_LABELS[role]?.bn ?? String(role).replace(/_/g, " ");

/**
 * Sticky rail + sticky context topbar + scrolling content — the shared admin
 * chrome, fully token-driven so one code path is correct in light and dark.
 *
 * The rail addresses AREAS (10 modules, constant height); a module's own
 * screens are `ModuleTabs` on the page (final_admin.md §9.1). Three rail
 * states: expanded 256px at xl+, compact 72px at lg–xl (recovers 184px on the
 * 1366×768 laptops schools actually buy), off-canvas drawer below lg.
 *
 * The topbar carries what the page is (breadcrumb + title), which academic year
 * it's writing to, and the page's primary action — none of which it held
 * before (T-1, T-3).
 */
function AdminShellInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { locale, t: tx, tb: t } = useT();
  const { collapsed, toggleCollapsed, pins, togglePin } = useRailState();
  const { data: me } = useAdminUser();

  const drawerRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useFocusTrap(drawerRef, drawerOpen, () => setDrawerOpen(false));
  useFocusTrap(menuRef, menuOpen, () => setMenuOpen(false), { lockScroll: false });

  const activeModule = resolveActiveModule(pathname);
  const activeTab = resolveActiveTab(activeModule, pathname);
  // B-7 / SRA F-4: a module the operator cannot use should not be
  // discoverable. RLS already blocks the data; this stops the rail advertising
  // dead ends — and it is what makes delegation visible, since an accountant
  // now sees a Fees-shaped product instead of every module in the school.
  // The rule itself (and why it fails open) lives in adminNav.ts.
  const { data: myPermissions } = useMyPermissions();
  const canSee = (mod: AdminModule) => canSeeModule(mod, myPermissions);
  const pinnedModules = pins
    .map((k) => ADMIN_ALL_MODULES.find((m) => m.key === k))
    .filter((m): m is AdminModule => Boolean(m) && canSee(m as AdminModule));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
      // "[" toggles the rail — matches the collapse affordance in the header.
      if (e.key === "[" && !(e.target as HTMLElement)?.closest?.("input,textarea,select,[contenteditable]")) {
        toggleCollapsed();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleCollapsed]);

  // Close transient chrome on navigation.
  useEffect(() => {
    setDrawerOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  const signOut = async () => {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  const renderZone = (isCollapsed: boolean) => (
    <nav aria-label={tx("প্রধান নেভিগেশন", "Main navigation")} className="flex flex-1 flex-col gap-1">
      <div className={cn("flex items-center gap-2.5 pb-2 pt-0.5", isCollapsed ? "justify-center px-0" : "px-1")}>
        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-lg font-bold text-text-on-primary">
          E
        </div>
        {!isCollapsed ? (
          <div className="leading-tight">
            <p className="text-body font-semibold font-latin">EduFusionBD</p>
            <p className="text-micro text-text-muted">{tx("অ্যাডমিন", "Admin")}</p>
          </div>
        ) : null}
      </div>

      {pinnedModules.length > 0 ? (
        <div className="flex flex-col gap-1 pb-1">
          {!isCollapsed ? (
            <p className="px-3 pb-1 pt-2 text-micro font-semibold uppercase tracking-wide text-text-secondary">
              {tx("পিন করা", "Pinned")}
            </p>
          ) : null}
          {pinnedModules.map((mod) => (
            <RailLink
              key={`pin-${mod.key}`}
              mod={mod}
              active={activeModule?.key === mod.key}
              collapsed={isCollapsed}
              pinned
              onTogglePin={togglePin}
              t={t}
            />
          ))}
          <div className="mx-2 mt-1 h-px bg-border-default" />
        </div>
      ) : null}

      {ADMIN_NAV_ZONES.map((zone, i) => (
        <div key={i} className="flex flex-col gap-1">
          {zone.label && !isCollapsed ? (
            // 12px text-secondary, not 11px text-muted — the IA's own scaffolding
            // was the least legible text on screen at 2.4:1 (audit N-10).
            <p className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">
              {locale === "bn" ? zone.label.bn : zone.label.en}
            </p>
          ) : null}
          {zone.items.filter(canSee).map((mod) => (
            <RailLink
              key={mod.key}
              mod={mod}
              active={activeModule?.key === mod.key}
              collapsed={isCollapsed}
              pinned={pins.includes(mod.key)}
              onTogglePin={togglePin}
              t={t}
            />
          ))}
        </div>
      ))}

      <div className="flex-1" />
      <div className="h-px w-full bg-border-default" />
      <div className="flex flex-col gap-1 pt-1">
        <RailLink
          mod={ADMIN_SETTINGS_MODULE}
          active={activeModule?.key === ADMIN_SETTINGS_MODULE.key}
          collapsed={isCollapsed}
          pinned={pins.includes(ADMIN_SETTINGS_MODULE.key)}
          onTogglePin={togglePin}
          t={t}
        />
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

      {/*
        Rail: compact by default at md–xl (this is the band that was entirely
        unhandled — a drawer with desktop-density content, audit R-1/R-4),
        expanded at xl+ unless the operator collapsed it.
      */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col gap-1 overflow-y-auto overflow-x-hidden border-r border-border-default bg-surface py-5 transition-[width] md:flex",
          collapsed ? "w-18 px-2" : "w-18 px-2 xl:w-64 xl:px-4",
        )}
      >
        {/* Collapsed below xl regardless of preference; expanded state only exists at xl+. */}
        <div className="hidden xl:contents">{!collapsed ? renderZone(false) : null}</div>
        <div className={cn(collapsed ? "contents" : "contents xl:hidden")}>{renderZone(true)}</div>
      </aside>

      {/* Drawer below md */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label={tx("বন্ধ করুন", "Close menu")}
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
          />
          <aside
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label={tx("নেভিগেশন", "Navigation")}
            tabIndex={-1}
            className="absolute left-0 top-0 flex h-full w-72 max-w-[85vw] flex-col gap-1 overflow-y-auto border-r border-border-default bg-surface px-4 py-5 shadow-e3 focus:outline-none"
          >
            <button
              type="button"
              aria-label={tx("বন্ধ করুন", "Close menu")}
              onClick={() => setDrawerOpen(false)}
              className="absolute right-3 top-3 grid size-8 place-items-center rounded-lg text-text-secondary hover:bg-sunken"
            >
              <X size={18} />
            </button>
            {renderZone(false)}
          </aside>
        </div>
      ) : null}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex flex-col gap-1 border-b border-border-default bg-surface px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              aria-label={tx("মেনু খুলুন", "Open menu")}
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen(true)}
              className="grid size-9 shrink-0 place-items-center rounded-lg border border-border-control text-text-secondary hover:bg-sunken md:hidden"
            >
              <Menu size={18} />
            </button>
            <button
              type="button"
              aria-label={collapsed ? tx("সাইডবার খুলুন", "Expand sidebar") : tx("সাইডবার সংকুচিত করুন", "Collapse sidebar")}
              onClick={toggleCollapsed}
              className="hidden size-9 shrink-0 place-items-center rounded-lg text-text-secondary hover:bg-sunken xl:grid"
            >
              {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>

            {/* Breadcrumb lives in the sticky bar so orientation survives scrolling (T-3). */}
            <nav aria-label="Breadcrumb" className="hidden min-w-0 flex-1 items-center gap-1.5 text-meta text-text-muted sm:flex">
              {activeModule ? (
                <>
                  <Link href={activeModule.href} className="truncate hover:text-text-secondary hover:underline">
                    {t(activeModule)}
                  </Link>
                  {activeTab ? (
                    <>
                      <span aria-hidden>›</span>
                      <span aria-current="page" className="truncate text-text-secondary">
                        {t(activeTab)}
                      </span>
                    </>
                  ) : null}
                </>
              ) : null}
            </nav>
            <div className="flex-1 sm:hidden" />

            <AcademicYearSelector />
            <button
              type="button"
              aria-label={tx("অনুসন্ধান", "Search")}
              onClick={() => setPaletteOpen(true)}
              className="grid size-9 place-items-center rounded-lg border border-border-control text-text-secondary hover:bg-sunken"
            >
              <Search size={18} />
            </button>
            <ThemeToggle />
            <LocaleToggle />
            <div className="mx-1 hidden h-7 w-px bg-border-default sm:block" />
            <div className="relative">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2 hover:bg-sunken"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-meta font-semibold text-text-on-primary">
                  {me?.initials ?? "—"}
                </span>
                <span className="hidden leading-tight sm:block">
                  <span className="block max-w-32 truncate text-meta font-semibold text-text-primary">
                    {me?.name ?? tx("লোড হচ্ছে…", "Loading…")}
                  </span>
                  {/* A-0.4 point 5. This read `me.role.replace(/_/g, " ")` —
                      the raw enum, in English, on a Bangla-only product. */}
                  {me?.role ? (
                    <span className="block text-micro text-text-muted">{roleLabel(me.role as Role)}</span>
                  ) : null}
                </span>
                <ChevronDown size={16} className="hidden text-text-muted sm:block" />
              </button>
              {menuOpen ? (
                <>
                  <button
                    type="button"
                    aria-hidden="true"
                    tabIndex={-1}
                    onClick={() => setMenuOpen(false)}
                    className="fixed inset-0 z-40 cursor-default"
                  />
                  <div
                    ref={menuRef}
                    role="menu"
                    tabIndex={-1}
                    className="absolute right-0 top-full z-50 mt-2 w-52 rounded-lg border border-border-default bg-surface py-1 shadow-e3 focus:outline-none"
                  >
                    {me?.email ? (
                      <p className="truncate border-b border-border-default px-3 pb-2 pt-1 text-micro text-text-muted">
                        {me.email}
                      </p>
                    ) : null}
                    {/* SRA B-4: this pointed at /admin/core/user-list — a list
                        of EVERY user in the institution, not the signed-in
                        user's own account. It had been wired to the nearest
                        existing route. */}
                    <Link
                      href="/admin/account"
                      role="menuitem"
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-meta font-medium text-text-primary hover:bg-sunken"
                    >
                      <User size={16} /> {tx("আমার অ্যাকাউন্ট", "My Account")}
                    </Link>
                    <Link
                      href="/admin/account?tab=security"
                      role="menuitem"
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-meta font-medium text-text-primary hover:bg-sunken"
                    >
                      <ShieldCheck size={16} /> {tx("নিরাপত্তা", "Security")}
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        setPaletteOpen(true);
                      }}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-meta font-medium text-text-primary hover:bg-sunken"
                    >
                      <Keyboard size={16} /> {tx("শর্টকাট (⌘K)", "Shortcuts (⌘K)")}
                    </button>
                    <Link
                      href="/admin/edusathi"
                      role="menuitem"
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-meta font-medium text-text-primary hover:bg-sunken"
                    >
                      <LifeBuoy size={16} /> {tx("সহায়তা", "Help")}
                    </Link>
                    <div className="my-1 h-px bg-border-default" />
                    <button
                      type="button"
                      role="menuitem"
                      onClick={signOut}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-meta font-medium text-danger-fg hover:bg-sunken"
                    >
                      <LogOut size={16} /> {tx("লগ আউট", "Sign out")}
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </header>

        {/* --shell-pad is the single source of truth for this padding; SaveBar
            bleeds against it instead of mirroring the values (audit S-5). */}
        <main
          id="admin-main"
          className="flex-1 overflow-y-auto p-[var(--shell-pad)] [--shell-pad:1rem] sm:[--shell-pad:1.5rem] lg:[--shell-pad:2rem]"
        >
          {/* --layout-max caps the measure on ultrawide displays (audit S-4). */}
          <div className="mx-auto flex w-full max-w-[var(--layout-max)] flex-col gap-5">
            <OfflineBanner
              message={tx(
                "ইন্টারনেট সংযোগ নেই — সংরক্ষণ করার আগে সংযোগ ফিরে আসা পর্যন্ত অপেক্ষা করুন",
                "You're offline — wait for the connection to return before saving",
              )}
            />
            <ArchivedYearBanner />
            {children}
          </div>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      {/* SRA B-3 — the shell is the only place that sees every admin screen. */}
      <IdleTimeout />
    </div>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <AcademicYearProvider>
      <AdminShellInner>{children}</AdminShellInner>
    </AcademicYearProvider>
  );
}
