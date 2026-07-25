import { describe, it, expect } from "vitest";
import { classifyError, describeError } from "./errors";

/**
 * The classifier is the whole point of the module: get it wrong and an operator
 * either sees raw Postgres text or a misleading message. Both paths are covered
 * — SQLSTATE (when the PostgrestError survived) and message text (when `api.ts`
 * did `throw new Error(error.message)` and dropped the code).
 */
describe("classifyError — by code", () => {
  const cases: [string, string][] = [
    ["23505", "duplicate"],
    ["23503", "referenced"],
    ["23502", "invalid"],
    ["23514", "invalid"],
    ["22P02", "invalid"],
    ["42501", "forbidden"],
    ["PGRST116", "not_found"],
    ["PGRST301", "session_expired"],
  ];
  it.each(cases)("code %s -> %s", (code, kind) => {
    expect(classifyError({ code, message: "whatever" })).toBe(kind);
  });
});

describe("classifyError — by message (code already lost)", () => {
  const cases: [string, string][] = [
    ['duplicate key value violates unique constraint "uq_student_code"', "duplicate"],
    ['insert or update violates foreign key constraint "fee_payment_invoice_fk"', "referenced"],
    ['new row violates check constraint "fee_invoice_check"', "invalid"],
    ['null value violates not-null constraint', "invalid"],
    ['invalid input syntax for type uuid: ""', "invalid"],
    ["no institution context", "no_tenant"],
    ["not authorized for this institution", "forbidden"],
    ["teacher not found in institution", "not_found"],
    ["JWT expired", "session_expired"],
    ["Failed to fetch", "offline"],
  ];
  it.each(cases)("%s -> %s", (message, kind) => {
    expect(classifyError(new Error(message))).toBe(kind);
  });
});

describe("classifyError — rate limiting (audit M-4)", () => {
  it("recognises a Supabase Auth 429 by status", () => {
    // The bug this fixes: the login screen showed "wrong password" for a throttled
    // request, so users retried and kept their own token bucket empty.
    expect(classifyError({ status: 429, message: "Request rate limit reached" })).toBe("rate_limited");
  });

  it.each(["over_request_rate_limit", "over_email_send_rate_limit", "over_sms_send_rate_limit"])(
    "recognises code %s",
    (code) => expect(classifyError({ code, message: "" })).toBe("rate_limited"),
  );

  it("recognises it from the message alone", () => {
    expect(classifyError(new Error("Too many requests"))).toBe("rate_limited");
  });

  it("does NOT classify a genuine credential rejection as rate limited", () => {
    // This must keep falling through to `unknown` so the login screen's
    // invalid-credentials fallback is used.
    expect(classifyError({ status: 400, message: "Invalid login credentials" })).toBe("unknown");
  });
});

describe("classifyError — zod (audit M-1)", () => {
  it("maps a schema failure onto the existing 'invalid' copy", () => {
    // Matched on `name` so errors.ts keeps zero runtime dependencies.
    const zodish = Object.assign(new Error("Expected string, received number"), { name: "ZodError" });
    expect(classifyError(zodish)).toBe("invalid");
  });
});

describe("classifyError — fallbacks", () => {
  it("returns unknown for anything unrecognised", () => {
    expect(classifyError(new Error("kaboom"))).toBe("unknown");
    expect(classifyError(null)).toBe("unknown");
    expect(classifyError(undefined)).toBe("unknown");
    expect(classifyError(42)).toBe("unknown");
    expect(classifyError({})).toBe("unknown");
  });

  it("prefers the code over the message when both are present", () => {
    // A duplicate-key message carried on a permission-denied code: the code wins.
    expect(classifyError({ code: "42501", message: "duplicate key value" })).toBe("forbidden");
  });
});

describe("describeError", () => {
  it("never leaks the raw message into user-facing copy", () => {
    const raw = 'duplicate key value violates unique constraint "uq_student_code"';
    const { bn, en } = describeError(new Error(raw));
    expect(en).not.toContain("uq_student_code");
    expect(bn).not.toContain("uq_student_code");
    expect(en.length).toBeGreaterThan(0);
    expect(bn.length).toBeGreaterThan(0);
  });

  it("has both languages for every kind", () => {
    const kinds = [
      new Error("duplicate key value"),
      new Error("violates foreign key constraint"),
      new Error("invalid input syntax"),
      new Error("not found"),
      new Error("permission denied"),
      new Error("JWT expired"),
      new Error("Failed to fetch"),
      new Error("no institution context"),
      new Error("Too many requests"),
      new Error("???"),
    ];
    for (const e of kinds) {
      const d = describeError(e);
      expect(d.bn.trim()).not.toBe("");
      expect(d.en.trim()).not.toBe("");
      // Bangla copy must actually be Bangla, not an English string copy-pasted.
      expect(d.bn).toMatch(/[ঀ-৿]/);
    }
  });
});
