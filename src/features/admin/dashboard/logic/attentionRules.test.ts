import { describe, it, expect } from "vitest";
import {
  evaluateAttention,
  ATTENDANCE_CUTOFF_HOUR,
  ATTENDANCE_FLOOR_PCT,
  type AttentionFacts,
} from "./attentionRules";

/** A school with nothing wrong: every rule silent. */
const CLEAR: AttentionFacts = {
  overdueStudents: 0,
  overdueAmount: 0,
  avgAttendance30: 96,
  lockedExams: 0,
  sectionsTotal: 9,
  sectionsAwaitingAttendance: 0,
  sectionsWithoutClassTeacher: 0,
  studentsWithoutGuardianContact: 0,
  hour: 14,
};

const facts = (over: Partial<AttentionFacts>): AttentionFacts => ({ ...CLEAR, ...over });

describe("evaluateAttention", () => {
  it("says nothing when nothing is wrong", () => {
    expect(evaluateAttention(CLEAR)).toEqual([]);
  });

  it("orders by the operating rhythm, not by discovery order", () => {
    // Everything at once. Today's blocker must outrank the term's, which must
    // outrank a standing data gap — that is the order the day runs in.
    const keys = evaluateAttention(
      facts({
        sectionsAwaitingAttendance: 3,
        overdueStudents: 14,
        overdueAmount: 84_000,
        lockedExams: 1,
        avgAttendance30: 61,
        sectionsWithoutClassTeacher: 9,
        studentsWithoutGuardianContact: 7,
      }),
    ).map((i) => i.key);

    expect(keys).toEqual([
      "attendance_pending",
      "overdue_fees",
      "results_pending",
      "attendance_low",
      "no_class_teacher",
      "no_guardian_contact",
    ]);
  });

  describe("attendance_pending", () => {
    it("stays silent before the cutoff — an unfilled register at 07:00 is not a problem", () => {
      const early = evaluateAttention(
        facts({ hour: ATTENDANCE_CUTOFF_HOUR - 1, sectionsAwaitingAttendance: 9 }),
      );
      expect(early).toEqual([]);
    });

    it("fires from the cutoff onward, carrying the section count", () => {
      const [item] = evaluateAttention(
        facts({ hour: ATTENDANCE_CUTOFF_HOUR, sectionsAwaitingAttendance: 4 }),
      );
      expect(item).toMatchObject({ key: "attendance_pending", count: 4, tone: "danger" });
    });
  });

  describe("attendance_low", () => {
    it("treats 'no attendance recorded at all' as silence, not as 0%", () => {
      // The regression this guards: `avgAttendance30 = 0` for a school that has
      // simply never taken attendance would raise a permanent "average
      // attendance 0%" alarm, which is a statement about the DATA, not the
      // students. `null` is the honest input and must produce no row.
      expect(evaluateAttention(facts({ avgAttendance30: null }))).toEqual([]);
    });

    it("fires below the floor and not at it", () => {
      expect(evaluateAttention(facts({ avgAttendance30: ATTENDANCE_FLOOR_PCT }))).toEqual([]);
      const [item] = evaluateAttention(facts({ avgAttendance30: ATTENDANCE_FLOOR_PCT - 1 }));
      expect(item).toMatchObject({ key: "attendance_low", count: ATTENDANCE_FLOOR_PCT - 1 });
    });
  });

  it("carries money on the rule that is about money, and only there", () => {
    const [fees] = evaluateAttention(facts({ overdueStudents: 14, overdueAmount: 84_000 }));
    expect(fees).toMatchObject({ count: 14, amount: 84_000 });

    const [teachers] = evaluateAttention(facts({ sectionsWithoutClassTeacher: 9 }));
    expect(teachers.amount).toBeUndefined();
  });

  it("does not leak the evaluator into the rendered item", () => {
    // The screen spreads these into props; an `evaluate` function riding along
    // would end up on a DOM node.
    const [item] = evaluateAttention(facts({ sectionsWithoutClassTeacher: 9 }));
    expect(item).not.toHaveProperty("evaluate");
  });
});
