"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { useMyPermissions } from "@/features/admin/core/logic/hooks";
import { getModule } from "./getModule";
import { canSeeTab } from "./adminNav";

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
 *
 * TABS ARE FILTERED ON PERMISSION (Settings audit M-4). A tab the caller cannot
 * use is removed rather than disabled: a disabled tab still advertises a screen
 * and still invites the click that produces the support ticket. Fail-open while
 * permissions load, so the strip never flickers from eleven tabs to eight to
 * eleven again on a slow connection.
 */
export function ModuleTabs({ moduleKey }: { moduleKey: string }) {
  const pathname = usePathname();
  const { t } = useT();
  const permissions = useMyPermissions();
  const mod = getModule(moduleKey);
  const tabs = (mod.tabs ?? []).filter((tab) => canSeeTab(mod, tab, permissions.data));
  if (tabs.length === 0) return null;

  let lastGroup: string | undefined;

  return (
    <div className="flex gap-1 overflow-x-auto border-b border-border-default" role="tablist" aria-label={t(mod.bn, mod.en)}>
      {tabs.map((tab) => {
        const groupKey = tab.group ? t(tab.group.bn, tab.group.en) : undefined;
        const showGroup = groupKey && groupKey !== lastGroup;
        lastGroup = groupKey;
        const active = pathname.startsWith(tab.href);
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
