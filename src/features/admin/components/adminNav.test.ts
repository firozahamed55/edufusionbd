/**
 * Every adminNav href must resolve to a real route (audit N-1 — EduSathi 404'd
 * for months because nothing checked this; roadmap 0.13). Next's `(admin)`
 * route group doesn't appear in the URL, so `/admin/x` maps to the file
 * `src/app/(admin)/admin/x/page.tsx`.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { ADMIN_NAV_SECTIONS, ADMIN_NAV_FOOTER } from "./adminNav";

const APP_DIR = join(__dirname, "..", "..", "..", "app", "(admin)");

function routeFile(href: string): string {
  return join(APP_DIR, ...href.split("/").filter(Boolean), "page.tsx");
}

function collectHrefs(): string[] {
  const hrefs = new Set<string>();
  for (const section of ADMIN_NAV_SECTIONS) {
    for (const item of section.items) {
      hrefs.add(item.href);
      for (const group of item.sub ?? []) {
        for (const sub of group.items) hrefs.add(sub.href);
      }
    }
  }
  for (const item of ADMIN_NAV_FOOTER) hrefs.add(item.href);
  return Array.from(hrefs);
}

describe("adminNav routes", () => {
  it.each(collectHrefs())("%s resolves to a real page", (href) => {
    expect(existsSync(routeFile(href))).toBe(true);
  });
});
