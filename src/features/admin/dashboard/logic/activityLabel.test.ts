import { describe, it, expect } from "vitest";
import { activitySentence, activityHref } from "./activityLabel";
import { collapseActivity } from "../screens/overview/logic/api";

describe("activitySentence (SRA B-2)", () => {
  it("renders a sentence, not the raw action·entity tokens", () => {
    expect(activitySentence("insert", "student")).toEqual({
      bn: "শিক্ষার্থী যোগ করা হয়েছে",
      en: "Student added",
    });
    expect(activitySentence("update", "fee_invoice").en).toBe("Fee invoice updated");
    expect(activitySentence("delete", "certificate_template").en).toBe("Certificate template removed");
  });

  it("pluralises a collapsed run", () => {
    expect(activitySentence("insert", "student", 268).en).toBe("268 student records added");
    expect(activitySentence("insert", "student", 268).bn).toBe("268টি শিক্ষার্থী যোগ করা হয়েছে");
  });

  it("falls back to the raw name for an unmapped entity rather than hiding it", () => {
    // A new table must not make its own activity invisible.
    expect(activitySentence("insert", "timetable_period").en).toBe("Timetable_period added");
    expect(activityHref("timetable_period")).toBeNull();
  });

  it("survives an unexpected action value", () => {
    expect(activitySentence("truncate", "student").en).toBe("student — truncate");
  });

  it("links a row to the screen its record lives on", () => {
    expect(activityHref("fee_payment")).toBe("/admin/fee/day-book");
  });
});

describe("collapseActivity (SRA B-2)", () => {
  const row = (id: string, action: string, entity: string, at = "2026-08-01T10:00:00Z") =>
    ({ id, action, entity, at });

  it("collapses a consecutive run into one item carrying the count", () => {
    const rows = Array.from({ length: 268 }, (_, i) => row(`s${i}`, "insert", "student"));
    const out = collapseActivity(rows);
    expect(out).toHaveLength(1);
    expect(out[0].count).toBe(268);
  });

  it("keeps a bulk import from pushing every other event off the panel", () => {
    const rows = [
      ...Array.from({ length: 50 }, (_, i) => row(`s${i}`, "insert", "student")),
      row("p1", "insert", "fee_payment"),
      row("n1", "insert", "notice"),
    ];
    const out = collapseActivity(rows);
    expect(out.map((a) => a.entity)).toEqual(["student", "fee_payment", "notice"]);
    expect(out[0].count).toBe(50);
  });

  it("does NOT merge non-adjacent runs — the feed is chronological", () => {
    // Two imports a week apart are two events, not one of size 2.
    const out = collapseActivity([
      row("a", "insert", "student", "2026-08-01T10:00:00Z"),
      row("b", "insert", "notice", "2026-07-25T10:00:00Z"),
      row("c", "insert", "student", "2026-07-24T10:00:00Z"),
    ]);
    expect(out).toHaveLength(3);
    expect(out.every((a) => a.count === 1)).toBe(true);
  });

  it("caps the list but still counts the run it is capped on", () => {
    const rows = [
      ...["a", "b", "c", "d", "e", "f"].map((k, i) => row(k, "insert", `e${i}`)),
      row("g", "insert", "e6"),
    ];
    expect(collapseActivity(rows, 6)).toHaveLength(6);
  });

  it("returns an empty list for no activity", () => {
    expect(collapseActivity([])).toEqual([]);
  });
});
