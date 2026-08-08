/**
 * Every adminNav href must resolve to a real route (audit N-1 — EduSathi 404'd
 * for months because nothing checked this; roadmap 0.13). Next's `(admin)`
 * route group doesn't appear in the URL, so `/admin/x` maps to the file
 * `src/app/(admin)/admin/x/page.tsx`.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { ADMIN_ALL_MODULES, canSeeModule, canSeeTab, permissionForPath } from "./adminNav";

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
      for (const tab of m.tabs ?? []) {
        if (tab.permission) expect(SEEDED.has(tab.permission), `${tab.href} → ${tab.permission}`).toBe(true);
      }
    }
  });
});

describe("canSeeTab (settings audit M-4)", () => {
  const core = mod("core");
  const tab = (href: string) => core.tabs!.find((x) => x.href === href)!;

  it("hides the three screens the DATABASE gates differently from the module", () => {
    // Exactly the hole H-1 describes: `core.settings` alone used to show all
    // eleven tabs, and the three Users tabs then rendered empty tables.
    const settingsOnly = ["core.settings"];
    expect(canSeeTab(core, tab("/admin/core/basic-config"), settingsOnly)).toBe(true);
    expect(canSeeTab(core, tab("/admin/core/user-list"), settingsOnly)).toBe(false);
    expect(canSeeTab(core, tab("/admin/core/permissions"), settingsOnly)).toBe(false);
    expect(canSeeTab(core, tab("/admin/core/audit-log"), settingsOnly)).toBe(false);
  });

  it("an institution admin sees all eleven", () => {
    const admin = ["core.settings", "core.user_manage", "audit.read"];
    expect(core.tabs!.filter((x) => canSeeTab(core, x, admin))).toHaveLength(11);
  });

  it("fails OPEN while loading and for an account with no roles", () => {
    expect(core.tabs!.filter((x) => canSeeTab(core, x, undefined))).toHaveLength(11);
    expect(core.tabs!.filter((x) => canSeeTab(core, x, []))).toHaveLength(11);
  });

  it("an accountant sees none of Settings", () => {
    const accountant = ["dashboard.view", "student.view", "fee.view", "sms.view"];
    expect(core.tabs!.filter((x) => canSeeTab(core, x, accountant))).toHaveLength(0);
  });
});

describe("permissionForPath", () => {
  it("resolves the screen's own permission, not the module's", () => {
    expect(permissionForPath("/admin/core/audit-log")).toBe("audit.read");
    expect(permissionForPath("/admin/core/user-list")).toBe("core.user_manage");
    expect(permissionForPath("/admin/core/calendar")).toBe("core.settings");
  });

  it("falls back to the module for a route with no tab of its own", () => {
    expect(permissionForPath("/admin/core")).toBe("core.settings");
    expect(permissionForPath("/admin/dashboard")).toBe("dashboard.view");
  });

  it("is undefined outside the admin nav", () => {
    expect(permissionForPath("/login")).toBeUndefined();
  });
});
