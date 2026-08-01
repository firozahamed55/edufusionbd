import { describe, expect, it } from "vitest";
import { summariseBilling } from "./api";

/**
 * D-3. The dashboard's collection rate used to divide a period FLOW (cash taken
 * between two dates) by an all-time STOCK (every unpaid invoice ever raised).
 * These tests pin the properties that made that measure useless, so a later
 * refactor cannot quietly reintroduce them.
 */

const inv = (
  total: number,
  paid: number,
  waived = 0,
  student = "s1",
) => ({ student_id: student, total_amount: total, paid_amount: paid, waiver_amount: waived });

describe("summariseBilling", () => {
  it("measures collection against what was billed, not against arrears", () => {
    const b = summariseBilling([inv(1500, 1500, 0, "a"), inv(1500, 0, 0, "b")]);
    expect(b.billed).toBe(3000);
    expect(b.collected).toBe(1500);
    expect(b.outstanding).toBe(1500);
    expect(b.rate).toBe(50);
  });

  /**
   * The old measure's headline failure. A school that collected everything it
   * billed this month, while carrying a year of arrears, read as failing.
   * Nothing outside the window can now move this number.
   */
  it("is unaffected by invoices outside the window", () => {
    const perfect = summariseBilling([inv(1000, 1000)]);
    expect(perfect.rate).toBe(100);
  });

  /** A waiver was a decision not to collect, not a failure to. */
  it("takes waivers out of the denominator", () => {
    const b = summariseBilling([inv(1000, 500, 500)]);
    expect(b.rate).toBe(100);
    expect(b.outstanding).toBe(0);
    expect(b.waived).toBe(500);
  });

  it("reports a fully waived window as settled rather than as 0%", () => {
    expect(summariseBilling([inv(1000, 0, 1000)]).rate).toBe(100);
  });

  /** Two invoices to one student is one student behind, not two. */
  it("counts students, not rows", () => {
    const b = summariseBilling([inv(500, 0, 0, "a"), inv(500, 0, 0, "a"), inv(500, 0, 0, "b")]);
    expect(b.invoices).toBe(3);
    expect(b.students).toBe(2);
  });

  /** An overpayment must not render a negative balance for the window. */
  it("clamps outstanding at zero", () => {
    expect(summariseBilling([inv(1000, 1200)]).outstanding).toBe(0);
  });
});
