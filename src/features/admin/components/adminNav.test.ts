/**
 * Every adminNav href must resolve to a real route (audit N-1 — EduSathi 404'd
 * for months because nothing checked this; roadmap 0.13). Next's `(admin)`
 * route group doesn't appear in the URL, so `/admin/x` maps to the file
 * `src/app/(admin)/admin/x/page.tsx`.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { ADMIN_ALL_MODULES, canSeeModule } from "./adminNav";

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

const mod = (key: string) => ADMIN_ALL_MODULES.find((m) => m.key === key)!;

describe("canSeeModule", () => {
  it("shows only what the caller's permissions cover", () => {
    // The accountant role, exactly as seeded by 20260726043308.
    const accountant = ["dashboard.view", "student.view", "fee.view", "fee.collect", "fee.mapping", "fee.void", "sms.view"];
    expect(canSeeModule(mod("fee"), accountant)).toBe(true);
    expect(canSeeModule(mod("student"), accountant)).toBe(true);
    expect(canSeeModule(mod("exam"), accountant)).toBe(false);
    expect(canSeeModule(mod("core"), accountant)).toBe(false);
  });

  it("fails OPEN while loading and for an account with no roles", () => {
    // An empty rail reads as a broken product, not as an access decision —
    // the rollout failure the SRA files as risk R-5. RLS is the control.
    expect(canSeeModule(mod("fee"), undefined)).toBe(true);
    expect(canSeeModule(mod("fee"), [])).toBe(true);
  });

  it("keys every module to a permission the database actually seeds", () => {
    // A typo here hides a module from everyone who is not failing open, and
    // nothing else in the stack would ever report it.
    const SEEDED = new Set([
      "dashboard.view",
      "student.view", "student.create", "student.update", "student.delete", "student.migrate",
      "teacher.view", "teacher.create", "teacher.update", "teacher.delete",
      "attendance.view", "attendance.mark",
      "exam.view", "exam.manage", "exam.mark_entry", "exam.result_process", "exam.result_publish",
      "fee.view", "fee.collect", "fee.void", "fee.mapping",
      "sms.view", "sms.send", "notice.manage",
      "certificate.view", "certificate.generate",
      "core.settings", "core.user_manage", "audit.read",
    ]);
    for (const m of ADMIN_ALL_MODULES) {
      if (m.permission) expect(SEEDED.has(m.permission), `${m.key} → ${m.permission}`).toBe(true);
    }
  });
});
