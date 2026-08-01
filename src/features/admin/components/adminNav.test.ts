/**
 * Every adminNav href must resolve to a real route (audit N-1 — EduSathi 404'd
 * for months because nothing checked this; roadmap 0.13). Next's `(admin)`
 * route group doesn't appear in the URL, so `/admin/x` maps to the file
 * `src/app/(admin)/admin/x/page.tsx`.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { ADMIN_ALL_MODULES, ADMIN_SETTINGS_MODULE, canSeeModule, canSeeTab } from "./adminNav";

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

/**
 * Settings audit M-4 — one permission used to gate all eleven Settings screens
 * while the database gated three of them on two other codes.
 *
 * A NOTE ON THE AUDIT'S OWN WORDING. §4 Phase 1.1 asks for "accountant sees 8
 * tabs". The seeded accountant (`20260726043308`) holds no `core.*` permission
 * at all, so it sees ZERO Settings tabs — and never reaches them, because
 * `canSeeModule` already hides the whole module from it (asserted above). The
 * case the audit means is a caller holding `core.settings` and nothing else,
 * which is what is asserted here.
 */
const settingsTabsFor = (permissions: readonly string[] | undefined) =>
  (ADMIN_SETTINGS_MODULE.tabs ?? []).filter((tab) =>
    canSeeTab(ADMIN_SETTINGS_MODULE, tab, permissions),
  );

describe("canSeeTab · Settings", () => {
  it("gives a core.settings-only caller the eight configuration screens", () => {
    const tabs = settingsTabsFor(["core.settings"]);
    expect(tabs).toHaveLength(8);
    expect(tabs.map((t) => t.href)).not.toContain("/admin/core/user-list");
    expect(tabs.map((t) => t.href)).not.toContain("/admin/core/permissions");
    expect(tabs.map((t) => t.href)).not.toContain("/admin/core/audit-log");
  });

  it("gives an institution admin all eleven", () => {
    expect(settingsTabsFor(["core.settings", "core.user_manage", "audit.read"])).toHaveLength(11);
  });

  it("fails OPEN while loading and for an account with no roles", () => {
    expect(settingsTabsFor(undefined)).toHaveLength(11);
    expect(settingsTabsFor([])).toHaveLength(11);
  });

  it("shows audit-log to audit.read alone, and not the two user screens", () => {
    const tabs = settingsTabsFor(["audit.read"]);
    expect(tabs.map((t) => t.href)).toEqual(["/admin/core/audit-log"]);
  });

  it("leaves every other module's tabs inheriting the module permission", () => {
    // Only Settings sets per-tab codes. If a second module ever does, this
    // test is the place to say so deliberately rather than by accident.
    const withTabPermissions = ADMIN_ALL_MODULES.filter((m) =>
      (m.tabs ?? []).some((t) => t.permission),
    );
    expect(withTabPermissions.map((m) => m.key)).toEqual(["core"]);
  });

  it("keys every Settings tab to a permission the database actually seeds", () => {
    const CORE_SEEDED = new Set(["core.settings", "core.user_manage", "audit.read"]);
    for (const tab of ADMIN_SETTINGS_MODULE.tabs ?? []) {
      expect(CORE_SEEDED.has(tab.permission ?? ""), `${tab.href} → ${tab.permission}`).toBe(true);
    }
  });
});
