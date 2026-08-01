import { describe, it, expect } from "vitest";
import { diffJson, jsonEqual, formatJsonValue } from "./jsonDiff";
import { isPiiKey, countRedactable, REDACTED } from "./auditRedaction";

/**
 * Settings audit M-14 / S-11.3, S-11.4 — Phase 1.3 QA.
 *
 * The rules that decide what an operator sees in a diff, tested without
 * rendering: what counts as a change, what is hidden as noise, and which keys
 * are treated as personal data.
 */

describe("diffJson", () => {
  it("reports only the keys that moved", () => {
    const { changes, unchanged } = diffJson(
      { name: "Rahim", roll: 12, section: "A" },
      { name: "Rahim", roll: 13, section: "A" },
    );
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ key: "roll", kind: "changed", before: 12, after: 13 });
    expect(unchanged).toEqual(["name", "section"]);
  });

  it("drops updated_at, or every single UPDATE would show a change", () => {
    const { changes } = diffJson(
      { name: "Rahim", updated_at: "2026-01-01T00:00:00Z" },
      { name: "Rahim", updated_at: "2026-02-01T00:00:00Z" },
    );
    expect(changes).toEqual([]);
  });

  it("distinguishes an added key from a removed one", () => {
    const { changes } = diffJson({ a: 1, b: 2 }, { a: 1, c: 3 });
    expect(changes.map((c) => [c.key, c.kind])).toEqual([
      ["b", "removed"],
      ["c", "added"],
    ]);
  });

  it("treats an INSERT as the whole payload added, not forty separate diffs to nothing", () => {
    const { changes, unchanged } = diffJson(null, { name: "Rahim", roll: 12 });
    expect(changes.every((c) => c.kind === "added")).toBe(true);
    expect(changes).toHaveLength(2);
    expect(unchanged).toEqual([]);
  });

  it("treats a DELETE the same way, in reverse", () => {
    const { changes } = diffJson({ name: "Rahim" }, null);
    expect(changes.map((c) => c.kind)).toEqual(["removed"]);
    expect(changes[0].before).toBe("Rahim");
  });

  it("returns nothing at all when both sides are absent", () => {
    expect(diffJson(null, null)).toEqual({ changes: [], unchanged: [] });
  });

  it("does not report a nested object as changed just because Postgres reordered its keys", () => {
    // jsonb stores keys sorted by length then bytewise, so key order is not
    // stable across a rewrite and an order-sensitive compare invents changes.
    const { changes } = diffJson(
      { meta: { a: 1, bb: 2 } },
      { meta: { bb: 2, a: 1 } },
    );
    expect(changes).toEqual([]);
  });

  it("orders changes by key, so the same edit always reads the same way", () => {
    const { changes } = diffJson({ z: 1, a: 1 }, { z: 2, a: 2 });
    expect(changes.map((c) => c.key)).toEqual(["a", "z"]);
  });
});

describe("jsonEqual", () => {
  it("compares by value, not by reference or serialisation order", () => {
    expect(jsonEqual({ a: [1, 2] }, { a: [1, 2] })).toBe(true);
    expect(jsonEqual({ a: [1, 2] }, { a: [2, 1] })).toBe(false);
    expect(jsonEqual(null, undefined)).toBe(true);
    expect(jsonEqual(0, "0")).toBe(false);
  });
});

describe("formatJsonValue", () => {
  it("prints absence as an em dash rather than the word null", () => {
    expect(formatJsonValue(null)).toBe("—");
    expect(formatJsonValue(undefined)).toBe("—");
    expect(formatJsonValue("")).toBe("—");
  });

  it("prints scalars plainly and structures as JSON", () => {
    expect(formatJsonValue(12)).toBe("12");
    expect(formatJsonValue(false)).toBe("false");
    expect(formatJsonValue({ a: 1 })).toBe('{"a":1}');
  });
});

describe("audit redaction", () => {
  it("catches the personal fields by substring, so guardian_phone is covered without listing it", () => {
    for (const key of ["phone", "guardian_phone", "father_mobile", "nid", "dob", "present_address", "email"]) {
      expect(isPiiKey(key), key).toBe(true);
    }
  });

  it("leaves the fields an audit is actually about alone", () => {
    for (const key of ["roll_no", "status", "class_id", "total_marks", "is_default"]) {
      expect(isPiiKey(key), key).toBe(false);
    }
  });

  it("counts what a reveal would uncover, for the prompt", () => {
    expect(countRedactable(["roll_no", "phone", "present_address"])).toBe(2);
    expect(REDACTED).not.toContain("null");
  });
});
