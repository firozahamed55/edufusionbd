import { beforeEach, describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderScreen, seed, setLocale } from "./testHarness";

setLocale("en");

/**
 * Phase 9.1 — what each screen REFUSES to send.
 *
 * The a11y suite asserts these screens are usable. This one asserts they are
 * safe: that an invalid value never reaches an RPC, that a delete blocked by a
 * hard reference never fires, and that a permission failure renders as "not for
 * you" rather than as an empty table. Those three are where every defect in the
 * audit lived, and none of them had a test.
 *
 * Asserting on the RPC LOG rather than on a toast is deliberate. A screen that
 * shows an error and sends the write anyway passes a toast assertion and fails
 * the product; the only honest question is whether the call happened.
 */

const { SubjectScreen } = await import("./subject/SubjectScreen");
const { GradingScreen } = await import("./grading/GradingScreen");
const { BasicConfigScreen } = await import("./basic-config/BasicConfigScreen");
const { PermissionMatrixScreen } = await import("./permissions/PermissionMatrixScreen");
const { SubjectGroupScreen } = await import("./subject-group/SubjectGroupScreen");

const SUBJECT = {
  id: "sub-1", name_bn: "বাংলা", name_en: "Bangla", code: "BAN", type: "compulsory",
  full_marks: 100, pass_marks: 33, min_class_level: 1, max_class_level: 10, status: "active",
};

const SCHEME = {
  id: "sch-1", name: "GPA 5.0", is_default: true,
  scales: [
    { grade_letter: "A+", gpa_point: 5, min_marks: 80, max_marks: 100 },
    { grade_letter: "F", gpa_point: 0, min_marks: 0, max_marks: 79 },
  ],
};

const ROWS = {
  subject: [SUBJECT],
  class: [{ id: "cls-1", name_bn: "ষষ্ঠ", name_en: "Six", numeric_level: 6, sections: [{ count: 1 }] }],
  grade_scheme: [SCHEME],
  subject_group: [],
  setting: [{ value: { working_days: "sun_thu", weekend: "fri_sat", pass_mark: 33 }, updated_at: "2026-08-01T00:00:00Z" }],
  institution: [],
  teacher: [],
};

const NO_IMPACT = { items: [], blocking: false };

beforeEach(() => {
  seed({ rows: ROWS, rpc: { fn_entity_impact: NO_IMPACT, fn_calendar_impact: NO_IMPACT } });
});

/* ------------------------------------------- invalid input is not sent */

describe("Subject · invalid input", () => {
  it("does not call the RPC when pass marks exceed full marks", async () => {
    const user = userEvent.setup();
    const log = seed({ rows: ROWS, rpc: { fn_entity_impact: NO_IMPACT } });
    renderScreen(<SubjectScreen />);

    await user.click(await screen.findByRole("button", { name: /new subject/i }));
    await user.type(screen.getByLabelText(/name \(bangla\)/i), "রসায়ন");
    await user.type(screen.getByLabelText(/name \(english\)/i), "Chemistry");

    const pass = screen.getByLabelText(/pass marks/i);
    await user.clear(pass);
    await user.type(pass, "120");

    await user.click(screen.getByRole("button", { name: /^save$/i }));

    // The defect this prevents is a cohort with zero passes, diagnosed six
    // weeks later on the results screen as a results bug.
    expect(log.filter((c) => c.fn === "fn_upsert_subject")).toHaveLength(0);
    expect(await screen.findByText(/pass marks cannot exceed full marks/i)).toBeInTheDocument();
  });

  it("sends the write when the values are valid", async () => {
    const user = userEvent.setup();
    const log = seed({ rows: ROWS, rpc: { fn_entity_impact: NO_IMPACT, fn_upsert_subject: "new-id" } });
    renderScreen(<SubjectScreen />);

    await user.click(await screen.findByRole("button", { name: /new subject/i }));
    await user.type(screen.getByLabelText(/name \(bangla\)/i), "রসায়ন");
    await user.type(screen.getByLabelText(/name \(english\)/i), "Chemistry");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    // A rule that rejects everything also passes the test above.
    expect(log.filter((c) => c.fn === "fn_upsert_subject")).toHaveLength(1);
  });
});

describe("Basic Config · the weekend contradiction", () => {
  it("refuses a Sun–Thu week beside a Sat–Sun weekend", async () => {
    const user = userEvent.setup();
    const log = seed({ rows: ROWS, rpc: {} });
    renderScreen(<BasicConfigScreen />);

    const weekend = await screen.findByLabelText(/weekend/i);
    await user.selectOptions(weekend, "sat_sun");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    // Sunday would be simultaneously a teaching day and a holiday; attendance
    // reads one half of that and the calendar reads the other.
    expect(log.filter((c) => c.fn === "fn_save_setting")).toHaveLength(0);
  });
});

describe("Subject Group · the empty group", () => {
  it("does not save a group with no subjects", async () => {
    const user = userEvent.setup();
    const log = seed({ rows: ROWS, rpc: { fn_entity_impact: NO_IMPACT } });
    renderScreen(<SubjectGroupScreen />);

    await user.click(await screen.findByRole("button", { name: /new group/i }));
    await user.type(screen.getByLabelText(/group name \(english\)/i), "Science");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    // It used to save happily and then render "No subjects" — a valid-looking
    // record that is a silent no-op in elective assignment.
    expect(log.filter((c) => c.fn === "fn_upsert_subject_group")).toHaveLength(0);
  });
});

/* --------------------------------------- a hard reference blocks a delete */

describe("Subject · delete with marks recorded", () => {
  it("disables the confirm and never calls the delete RPC", async () => {
    const user = userEvent.setup();
    const log = seed({
      rows: ROWS,
      rpc: {
        fn_entity_impact: { items: [{ key: "recorded_marks", count: 2000, blocking: true }], blocking: true },
      },
    });
    renderScreen(<SubjectScreen />);

    await user.click(await screen.findByRole("button", { name: /delete bangla/i }));
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByText(/2000 recorded marks/i)).toBeInTheDocument();
    const confirm = within(dialog).getByRole("button", { name: /^delete$/i });
    expect(confirm).toBeDisabled();

    await user.click(confirm);
    // A hard reference is not something to warn about — it is something the
    // dialog must not let happen.
    expect(log.filter((c) => c.fn === "fn_delete_subject")).toHaveLength(0);
  });

  it("allows the delete when nothing points at the subject", async () => {
    const user = userEvent.setup();
    const log = seed({ rows: ROWS, rpc: { fn_entity_impact: NO_IMPACT, fn_delete_subject: null } });
    renderScreen(<SubjectScreen />);

    await user.click(await screen.findByRole("button", { name: /delete bangla/i }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /^delete$/i }));

    expect(log.filter((c) => c.fn === "fn_delete_subject")).toHaveLength(1);
  });
});

/* ------------------------------------------------ S-8.5 · the locked bands */

describe("Grading · a scheme that has already graded a cohort", () => {
  it("omits `scales` from the payload so a rename stays possible", async () => {
    const user = userEvent.setup();
    const log = seed({
      rows: ROWS,
      rpc: {
        fn_entity_impact: { items: [{ key: "processed_results", count: 412, blocking: true }], blocking: true },
        fn_upsert_grade_scheme: "sch-1",
      },
    });
    renderScreen(<GradingScreen />);

    // One pencil per band, all opening the same whole-scheme editor (S-8.1).
    await user.click((await screen.findAllByRole("button", { name: /edit all grades/i }))[0]);
    expect(await screen.findByText(/already graded 412 results/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^save$/i }));

    const call = log.find((c) => c.fn === "fn_upsert_grade_scheme");
    expect(call).toBeDefined();
    // Marks are stored; the bands that turn them into letters are not
    // versioned. Sending `scales` here is what makes a reprinted marksheet
    // disagree with the one the parent is holding.
    expect((call!.args as { payload: Record<string, unknown> }).payload).not.toHaveProperty("scales");
  });

  it("sends `scales` for a scheme that has graded nothing", async () => {
    const user = userEvent.setup();
    const log = seed({ rows: ROWS, rpc: { fn_entity_impact: NO_IMPACT, fn_upsert_grade_scheme: "sch-1" } });
    renderScreen(<GradingScreen />);

    // One pencil per band, all opening the same whole-scheme editor (S-8.1).
    await user.click((await screen.findAllByRole("button", { name: /edit all grades/i }))[0]);
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    const call = log.find((c) => c.fn === "fn_upsert_grade_scheme");
    expect((call!.args as { payload: Record<string, unknown> }).payload).toHaveProperty("scales");
  });
});

/* ------------------------------------------------ M-4 · denied is not empty */

describe("Permission Matrix · a caller without core.user_manage", () => {
  it("renders no-access, not an empty table", async () => {
    seed({ rows: ROWS, rpc: {}, rpcError: { fn_permission_matrix: "permission denied for function" } });
    renderScreen(<PermissionMatrixScreen />);

    // "Nothing here" and "not for you" must not look identical — the audit's
    // M-4 is precisely that an authorization failure rendered as empty results.
    expect(await screen.findByText(/do not have access/i)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
