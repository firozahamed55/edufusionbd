import { ADMIN_ALL_MODULES, type AdminModule, type AdminTab } from "./adminNav";

/**
 * Exactly one module (and, within it, exactly one tab) reads as active for any
 * pathname — resolved by LONGEST prefix match, not "does it start with"
 * (closes N-2: Students and Reports used to both light up on
 * `/admin/student/reports-summary` because both individually matched).
 */
export function resolveActiveModule(pathname: string): AdminModule | null {
  let best: AdminModule | null = null;
  for (const mod of ADMIN_ALL_MODULES) {
    if (pathname.startsWith(mod.match) && (!best || mod.match.length > best.match.length)) {
      best = mod;
    }
  }
  return best;
}

export function resolveActiveTab(mod: AdminModule | null, pathname: string): AdminTab | null {
  if (!mod?.tabs) return null;
  let best: AdminTab | null = null;
  for (const tab of mod.tabs) {
    const prefixes = Array.isArray(tab.match) ? tab.match : [tab.match ?? tab.href];
    for (const p of prefixes) {
      if (pathname.startsWith(p) && (!best || p.length > (Array.isArray(best.match) ? best.match[0] : best.match ?? best.href).length)) {
        best = tab;
      }
    }
  }
  return best;
}
