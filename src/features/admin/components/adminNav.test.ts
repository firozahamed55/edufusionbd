/**
 * Every adminNav href must resolve to a real route (audit N-1 — EduSathi 404'd
 * for months because nothing checked this; roadmap 0.13). Next's `(admin)`
 * route group doesn't appear in the URL, so `/admin/x` maps to the file
 * `src/app/(admin)/admin/x/page.tsx`.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { ADMIN_ALL_MODULES } from "./adminNav";

const APP_DIR = join(__dirname, "..", "..", "..", "app", "(admin)");

function routeFile(href: string): string {
  return join(APP_DIR, ...href.split("/").filter(Boolean), "page.tsx");
}

function collectHrefs(): string[] {
  const hrefs = new Set<string>();
  for (const mod of ADMIN_ALL_MODULES) {
    hrefs.add(mod.href);
    for (const tab of mod.tabs ?? []) hrefs.add(tab.href);
  }
  return Array.from(hrefs);
}

describe("adminNav routes", () => {
  it.each(collectHrefs())("%s resolves to a real page", (href) => {
    expect(existsSync(routeFile(href))).toBe(true);
  });
});

describe("adminNav active resolution", () => {
  it("every module has a distinct match prefix (closes N-2: no two modules ever both read as active)", () => {
    const matches = ADMIN_ALL_MODULES.map((m) => m.match);
    expect(new Set(matches).size).toBe(matches.length);
  });
});
