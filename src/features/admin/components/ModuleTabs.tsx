"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { useMyPermissions } from "../core/logic/hooks";
import { canSeeTab } from "./adminNav";
import { getModule } from "./getModule";

/**
 * Generalised `SettingsShell` (final_admin.md §9.5) — the in-page sub-nav
 * contract for every admin module. The rail now carries only the 10 modules;
 * a module's own screens render here as tabs that are visible on arrival,
 * not revealed only by navigating (closes N-4/N-6).
 *
 * Takes the module KEY, not the module: the caller is a Server Component route
 * layout, and an `AdminModule` carries a Lucide `icon` component — a function,
 * which RSC cannot serialize across the server/client boundary. Looking it up
 * on this side of the boundary keeps the prop a plain string.
 *
 * Renders nothing for single-screen modules (no `tabs`) — Dashboard, EduSathi,
 * Reports — so this is safe to drop into every module layout unconditionally.
 */
export function ModuleTabs({ moduleKey }: { moduleKey: string }) {
  const pathname = usePathname();
  const { t } = useT();
  const { data: permissions } = useMyPermissions();
  const mod = getModule(moduleKey);
  if (!mod.tabs || mod.tabs.length === 0) return null;

  // Settings audit M-4: a tab the caller cannot use is worse than a missing
  // one, because clicking it produces an empty screen that reads as a bug.
  // Fails open while permissions load — see `canSeeTab`.
  const tabs = mod.tabs.filter((tab) => canSeeTab(mod, tab, permissions));
  if (tabs.length === 0) return null;

  /*
   * Longest prefix wins, not first prefix.
   *
   * The Settings hub lives at `/admin/core`, which is a prefix of all eleven
   * other tabs — a plain `startsWith` would light up "Overview" on every screen
   * in the module and mark two tabs current at once. Same rule the rail uses.
   */
  const activeHref = tabs
    .filter((tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`))
    .reduce<string | null>((best, tab) => (best && best.length >= tab.href.length ? best : tab.href), null);

  let lastGroup: string | undefined;

  return (
    <div className="flex gap-1 overflow-x-auto border-b border-border-default" role="tablist" aria-label={t(mod.bn, mod.en)}>
      {tabs.map((tab) => {
        const groupKey = tab.group ? t(tab.group.bn, tab.group.en) : undefined;
        const showGroup = groupKey && groupKey !== lastGroup;
        lastGroup = groupKey;
        const active = tab.href === activeHref;
        return (
          <div key={tab.href} className="flex shrink-0 items-center">
            {showGroup ? (
              <span className="mr-1 whitespace-nowrap px-2 pb-3 text-micro font-semibold uppercase tracking-wide text-text-decorative">
                {groupKey}
              </span>
            ) : null}
            <Link
              href={tab.href}
              role="tab"
              aria-selected={active}
              aria-current={active ? "page" : undefined}
              className={cn(
                "-mb-px whitespace-nowrap border-b-2 px-3 pb-3 text-sm font-medium transition-colors",
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-text-secondary hover:text-text-primary",
              )}
            >
              {t(tab.bn, tab.en)}
            </Link>
          </div>
        );
      })}
    </div>
  );
}
