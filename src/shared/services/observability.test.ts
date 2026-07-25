/**
 * The logger's job is to be readable AND to not leak. Both are testable, and both
 * have already failed once during development (see the `err_name` case below), so
 * neither is theoretical.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { logEvent, logHandledError, reportError, scrub } from "./observability";

/** Capture the single JSON line a call emits, parsed. */
function capture(level: "log" | "warn" | "error", fn: () => void): Record<string, unknown> {
  const spy = vi.spyOn(console, level).mockImplementation(() => {});
  fn();
  expect(spy).toHaveBeenCalledTimes(1);
  return JSON.parse(spy.mock.calls[0][0] as string);
}

afterEach(() => vi.restoreAllMocks());

describe("scrub", () => {
  it("redacts the PII a school system is full of", () => {
    const out = scrub({
      name_bn: "রফিক",
      name_en: "Rafiq",
      mobile: "+8801712345678",
      guardian_mobile: "+8801812345678",
      dob: "2011-04-02",
      amount: "1200",
      access_token: "eyJ…",
    });
    expect(Object.values(out).every((v) => v === "[redacted]")).toBe(true);
  });

  it("keeps the non-identifying fields that make a log useful", () => {
    expect(scrub({ student_count: 42, page: 3, kind: "duplicate", ok: false })).toEqual({
      student_count: 42,
      page: 3,
      kind: "duplicate",
      ok: false,
    });
  });

  it("drops undefined instead of emitting nulls", () => {
    expect(scrub({ a: 1, b: undefined })).toEqual({ a: 1 });
  });
});

describe("reportError", () => {
  it("emits one JSON line with the fields an on-call engineer needs", () => {
    const err = Object.assign(new Error("boom"), { digest: "abc123", code: "23505" });
    const line = capture("error", () => reportError(err, "rsc:/admin/fee"));

    expect(line.level).toBe("error");
    expect(line.event).toBe("unhandled_error");
    expect(line.where).toBe("rsc:/admin/fee");
    expect(line.err_message).toBe("boom");
    expect(line.digest).toBe("abc123"); // the join key to the user's error screen
    expect(line.code).toBe("23505");
    expect(typeof line.ts).toBe("string");
  });

  it("does NOT redact the error's own type", () => {
    // Regression: `scrub` matches on key name and `err_name` contains "name", so
    // routing trusted fields through the scrubber replaced every error's type with
    // "[redacted]" — destroying the logs this module exists to produce.
    const line = capture("error", () => reportError(new TypeError("nope"), "test"));
    expect(line.err_name).toBe("TypeError");
  });

  it("survives a thrown non-Error", () => {
    const line = capture("error", () => reportError("just a string", "test"));
    expect(line.err_message).toBe("just a string");
    expect(line.err_name).toBe("string");
  });

  it("still scrubs caller-supplied context", () => {
    const line = capture("error", () => reportError(new Error("x"), "test", { mobile: "017…" }));
    expect(line.mobile).toBe("[redacted]");
  });
});

describe("levels", () => {
  it("logs a handled error at warn so it never competes with an incident", () => {
    const line = capture("warn", () => logHandledError(new Error("dup"), "data_layer", { kind: "duplicate" }));
    expect(line.level).toBe("warn");
    expect(line.event).toBe("handled_error");
    expect(line.kind).toBe("duplicate");
  });

  it("logs an event at info", () => {
    expect(capture("log", () => logEvent("csv_export", { rows: 120 })).level).toBe("info");
  });
});
