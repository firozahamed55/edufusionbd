import { beforeEach, describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
// Imported first, deliberately: the harness registers the Supabase, locale and
// router mocks, and a screen module evaluated before them captures the real
// client.
import { expectNoAxeViolations, renderScreen, seed, setLocale } from "./testHarness";

setLocale("en");

/**
 * Phase 3's accessibility gate for the Settings module.
 *
 * The audit found nine WCAG 2.2 AA failures across eleven screens and no test
 * anywhere that could have caught one of them. These are the assertions that
 * would have: axe on every screen, plus a named test per verified failure so a
 * regression reads as "the calendar lost its grid role", not as a diff in a
 * generic violation count.
 */

/*
 * Top-level await, not static imports: `installSupabaseMock` must have run
 * before a screen module is evaluated, or the real `createClient` is captured
 * and every query goes to a Supabase URL that does not exist in a test.
 */
const { BasicConfigScreen } = await import("./basic-config/BasicConfigScreen");
const { StartupScreen } = await import("./startup/StartupScreen");
const { ClassScreen } = await import("./class/ClassScreen");
const { CalendarScreen } = await import("./calendar/CalendarScreen");
const { SignatureScreen } = await import("./signature/SignatureScreen");
const { SubjectScreen } = await import("./subject/SubjectScreen");
const { SubjectGroupScreen } = await import("./subject-group/SubjectGroupScreen");
const { GradingScreen } = await import("./grading/GradingScreen");
const { PermissionMatrixScreen } = await import("./permissions/PermissionMatrixScreen");
const { UserListScreen } = await import("./user-list/UserListScreen");
const { AuditLogScreen } = await import("./audit-log/AuditLogScreen");

const INSTITUTION = {
  id: "inst-1", name_bn: "গ্রীন ভ্যালি", name_en: "Green Valley", eiin: "123456",
  institution_type: "school", address: "Dhaka", phone: "01712345678", email: "a@b.com",
  website: "gvs.edu.bd", established_year: 1998, board_id: null, head_teacher_id: null,
  logo_file_id: null, metadata: {},
};

const SUBJECTS = [
  { id: "sub-1", name_bn: "বাংলা", name_en: "Bangla", code: "BAN", type: "compulsory", full_marks: 100, pass_marks: 33, min_class_level: 1, max_class_level: 10, status: "active" },
];

const SCHEMES = [
  {
    id: "sch-1", name: "GPA 5.0", is_default: true,
    scales: [
      { grade_letter: "A+", gpa_point: 5, min_marks: 80, max_marks: 100 },
      { grade_letter: "F", gpa_point: 0, min_marks: 0, max_marks: 79 },
    ],
  },
];

const BASE_ROWS = {
  institution: [INSTITUTION],
  setting: [{ value: { working_days: "sun_thu", weekend: "fri_sat", pass_mark: 33 }, updated_at: "2026-08-01T00:00:00Z" }],
  class: [{ id: "cls-1", name_bn: "ষষ্ঠ", name_en: "Six", numeric_level: 6, sections: [{ count: 2 }] }],
  subject: SUBJECTS,
  subject_group: [{ id: "grp-1", name: "Science", name_bn: "বিজ্ঞান", members: [] }],
  grade_scheme: SCHEMES,
  signature: [],
  teacher: [],
  education_board: [],
  class_section: [],
  academic_term: [],
  profile: [{ id: "prof-1", full_name: "Md. Rahim", phone: "01712345678", email: "rahim@gvs.edu.bd", status: "active", last_login_at: null, roles: [] }],
};

const AUDIT_PAGE = {
  rows: [{
    id: "aud-1", entity: "student", entity_id: "stu-1", action: "update",
    at: "2026-08-01T10:00:00Z", changed_by: "prof-1", changed_by_name: "Md. Rahim",
    severity: "normal", before: { name_en: "A" }, after: { name_en: "B" },
    changed_keys: ["name_en"], redacted_keys: [],
  }],
  total: 1,
};

const MATRIX = {
  roles: [{ id: "r1", code: "institution_admin", name: "Admin", is_system: true, description: null, user_count: 1 }],
  permissions: [{ id: "p1", code: "core.settings", label: "Manage settings", module: "core" }],
  grants: [{ role_id: "r1", permission_id: "p1" }],
};

beforeEach(() => {
  seed({
    rows: BASE_ROWS,
    rpc: {
      fn_permission_matrix: MATRIX,
      fn_calendar_range: [],
      fn_entity_impact: { items: [], blocking: false },
      fn_calendar_impact: { items: [], blocking: false },
      fn_audit_log: AUDIT_PAGE,
      fn_audit_actors: [{ id: "prof-1", name: "Md. Rahim" }],
      fn_my_permissions: ["core.settings", "core.user_manage", "audit.read"],
    },
  });
});

/* ------------------------------------------------------------------- axe */

const SCREENS: [string, () => React.ReactElement][] = [
  ["Basic Config", () => <BasicConfigScreen />],
  ["StartUp", () => <StartupScreen />],
  ["Class Config", () => <ClassScreen />],
  ["Academic Calendar", () => <CalendarScreen />],
  ["Signature", () => <SignatureScreen />],
  ["Subject List", () => <SubjectScreen />],
  ["Subject Group", () => <SubjectGroupScreen />],
  ["Grading Scheme", () => <GradingScreen />],
  ["Permission Matrix", () => <PermissionMatrixScreen />],
  ["Users & Roles", () => <UserListScreen />],
  ["Audit Log", () => <AuditLogScreen />],
];

describe.each(SCREENS)("%s", (_name, Screen) => {
  it("has no axe violations", async () => {
    const { container } = renderScreen(<Screen />);
    // Let the queries settle so the real content is asserted, not the skeleton.
    await screen.findAllByRole("heading", {}, { timeout: 3000 });
    await expectNoAxeViolations(container);
  });
});

describe("Bangla render", () => {
  it("stays axe-clean in Bangla — the labels are what change, not the semantics", async () => {
    setLocale("bn");
    try {
      for (const [, Screen] of SCREENS) {
        const { container, unmount } = renderScreen(<Screen />);
        await screen.findAllByRole("heading", {}, { timeout: 3000 });
        await expectNoAxeViolations(container);
        unmount();
      }
    } finally {
      setLocale("en");
    }
  });
});

/* -------------------------------------------------- A-1 / A-2 · the toggles */

describe("A-1 · Basic Config feature toggles", () => {
  it("exposes each toggle as a switch with a state, not a bare button", async () => {
    renderScreen(<BasicConfigScreen />);
    const switches = await screen.findAllByRole("switch");
    expect(switches).toHaveLength(4);
    for (const s of switches) {
      // The failure this replaces: "Parent SMS notifications, button" —
      // announced identically whether it was on or off.
      expect(s).toHaveAttribute("aria-checked");
      expect(s).toHaveAccessibleName();
    }
  });

  it("flips aria-checked when pressed", async () => {
    const user = userEvent.setup();
    renderScreen(<BasicConfigScreen />);
    const [first] = await screen.findAllByRole("switch");
    const before = first.getAttribute("aria-checked");
    await user.click(first);
    expect(first.getAttribute("aria-checked")).not.toBe(before);
  });
});

describe("A-2 · the Subject 'Active' toggle", () => {
  it("has an accessible name — it was announced as 'button' with none", async () => {
    const user = userEvent.setup();
    renderScreen(<SubjectScreen />);
    await user.click(await screen.findByRole("button", { name: /new subject/i }));
    const toggle = await screen.findByRole("switch");
    expect(toggle).toHaveAccessibleName(/active/i);
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });
});

/* ------------------------------------------------------ A-3 · the month grid */

describe("A-3 · Academic Calendar month grid", () => {
  it("is a real grid with rows and cells", async () => {
    renderScreen(<CalendarScreen />);
    const grid = await screen.findByRole("grid");
    // Header row plus one row per week.
    expect(within(grid).getAllByRole("row").length).toBeGreaterThan(4);
    expect(within(grid).getAllByRole("gridcell").length).toBeGreaterThan(27);
  });

  it("names each day by date, weekday and state — not by the bare day number", async () => {
    renderScreen(<CalendarScreen />);
    const grid = await screen.findByRole("grid");
    const days = within(grid).getAllByRole("button");
    const name = days[0].getAttribute("aria-label") ?? "";
    expect(name).toMatch(/\d{4}/);              // the year
    expect(name).toMatch(/day\b/i);             // the weekday
    expect(name).toMatch(/working day|holiday/i); // what it is
  });

  it("keeps exactly one cell in the tab order and moves focus with arrows", async () => {
    const user = userEvent.setup();
    renderScreen(<CalendarScreen />);
    const grid = await screen.findByRole("grid");
    const tabbable = within(grid).getAllByRole("button").filter((b) => b.tabIndex === 0);
    expect(tabbable).toHaveLength(1);

    tabbable[0].focus();
    const startId = document.activeElement?.id ?? "";
    await user.keyboard("{ArrowRight}");
    // Reaching 28 April used to cost 28 Tab presses.
    expect(document.activeElement?.id).not.toBe(startId);
    expect(document.activeElement?.id).toMatch(/^cal-\d{4}-\d{2}-\d{2}$/);
  });
});

/* ------------------------------------------- A-7 · permission matrix reflow */

describe("A-7 · Permission Matrix", () => {
  it("pins the capability column so a row keeps its identity while scrolling", async () => {
    renderScreen(<PermissionMatrixScreen />);
    const header = await screen.findByRole("columnheader", { name: /capability/i });
    expect(header.className).toContain("sticky");
    expect(header.className).toContain("left-0");
  });
});

/* ------------------------------------------------ A-5 · Signature save model */

describe("A-5 · Signature", () => {
  it("does not write on blur — a form commits when the operator says so", async () => {
    const user = userEvent.setup();
    const log = seed({ rows: BASE_ROWS, rpc: { fn_entity_impact: { items: [], blocking: false } } });
    renderScreen(<SignatureScreen />);

    const inputs = await screen.findAllByLabelText(/name/i);
    await user.type(inputs[0], "Md. Rahim Uddin");
    await user.tab();
    // Tabbing through the four cards used to fire four writes.
    expect(log.filter((c) => c.fn === "fn_upsert_signature")).toHaveLength(0);

    await user.click(screen.getAllByRole("button", { name: /^save$/i })[0]);
    expect(log.filter((c) => c.fn === "fn_upsert_signature")).toHaveLength(1);
  });

  it("refuses a blank signatory name rather than printing a blank signature block", async () => {
    const user = userEvent.setup();
    const log = seed({ rows: { ...BASE_ROWS, signature: [{ id: "sig-1", role_label: "head_teacher", holder_name: "Old Name", image_file_id: null }] }, rpc: {} });
    renderScreen(<SignatureScreen />);

    const input = (await screen.findAllByLabelText(/name/i))[0];
    await user.clear(input);
    await user.click(screen.getAllByRole("button", { name: /^save$/i })[0]);
    expect(log.filter((c) => c.fn === "fn_upsert_signature")).toHaveLength(0);
  });
});
