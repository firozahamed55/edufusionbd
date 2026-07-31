import { describe, expect, it } from "vitest";
import { validateGradeScale } from "./gradeScale";
import type { GradeScale } from "./api";

const g = (grade_letter: string, min_marks: number, max_marks: number, gpa_point = 1): GradeScale => ({
  grade_letter, min_marks, max_marks, gpa_point,
});

// The Bangladeshi GPA-5 default the screen ships with.
const VALID: GradeScale[] = [
  g("A+", 80, 100, 5), g("A", 70, 79, 4), g("A-", 60, 69, 3.5),
  g("B", 50, 59, 3), g("C", 40, 49, 2), g("D", 33, 39, 1), g("F", 0, 32, 0),
];

describe("validateGradeScale", () => {
  it("accepts a contiguous 0–100 scheme", () => {
    expect(validateGradeScale(VALID)).toEqual([]);
  });

  it("catches overlapping bands", () => {
    const bad = [g("A+", 80, 100, 5), g("A", 75, 85, 4), g("F", 0, 74, 0)];
    expect(validateGradeScale(bad).some((p) => p.en.includes("overlaps"))).toBe(true);
  });

  it("catches a hole in the middle", () => {
    const bad = [g("A+", 73, 100, 5), g("F", 0, 70, 0)];
    expect(validateGradeScale(bad).some((p) => p.en === "No grade covers marks 71–72.")).toBe(true);
  });

  it("catches a scheme that does not reach 100 or start at 0", () => {
    const short = [g("A", 10, 90, 4)];
    const problems = validateGradeScale(short).map((p) => p.en);
    expect(problems).toContain("No grade covers marks 0–9.");
    expect(problems).toContain("No grade covers marks 91–100.");
  });

  it("catches an inverted band", () => {
    const bad = [g("A", 90, 50, 4)];
    expect(validateGradeScale(bad).some((p) => p.en.includes("is above maximum"))).toBe(true);
  });

  it("catches duplicate grade letters", () => {
    const bad = [g("A", 0, 50, 4), g("a", 51, 100, 4)];
    expect(validateGradeScale(bad).some((p) => p.en.includes("more than once"))).toBe(true);
  });

  it("catches a scheme nobody could pass", () => {
    const bad = [g("F", 0, 100, 0)];
    expect(validateGradeScale(bad).some((p) => p.en.includes("nobody could pass"))).toBe(true);
  });

  it("rejects an empty scheme", () => {
    expect(validateGradeScale([])).toHaveLength(1);
  });

  it("ignores unfilled rows so typing does not spray errors", () => {
    expect(validateGradeScale([...VALID, g("", 0, 0, 0)])).toEqual([]);
  });
});
