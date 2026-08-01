import { describe, expect, it } from "vitest";
import {
  academicFindings,
  atRiskFindings,
  concentration,
  enrolmentFindings,
  mean,
  stdDev,
} from "./insights";

/**
 * R-3. These rules decide what a head teacher is told to look at, so the
 * properties worth pinning are the ones that make a finding trustworthy: it
 * fires on the real thing, and it stays quiet on the near-miss.
 */

describe("primitives", () => {
  it("has no spread below two observations", () => {
    // A one-section school must not become an outlier detector that fires on
    // everything because sigma came back 0.
    expect(stdDev([30])).toBeNull();
    expect(mean([])).toBeNull();
  });

  it("ignores non-positive contributors when concentrating", () => {
    const c = concentration([100, 0, 0, 50], 1);
    expect(c).toEqual({ share: 100 / 150, count: 1, total: 150 });
  });

  it("returns null when there is nothing to concentrate", () => {
    expect(concentration([0, 0], 5)).toBeNull();
  });
});

describe("enrolmentFindings", () => {
  const cls = (name: string, total: number, sections = 2) => ({
    name_bn: name, name_en: name, total, sections,
  });

  /**
   * The rule's whole reason for having a second condition. Classes of 28, 29
   * and 31 are a standard deviation apart, so 31 sits many σ clear of the
   * other two — and "Class Three has 31 students, 2 above average" is not
   * worth a sentence.
   */
  it("stays silent on a spread that is statistically real but operationally trivial", () => {
    const f = enrolmentFindings({
      classes: [cls("One", 28), cls("Two", 29), cls("Three", 31)],
      total: 88, boys: 44, girls: 44, dobMissing: 0, religionMissing: 0,
    });
    expect(f).toEqual([]);
  });

  /**
   * And the reason for leave-one-out. Judged against a mean and sigma it is
   * itself inside, the 41 sits only 1.15σ out and the rule that exists to
   * catch it says nothing.
   */
  it("is not masked by its own contribution to the spread", () => {
    const sizes = [25, 26, 41];
    const m = sizes.reduce((s, v) => s + v, 0) / 3;
    const sd = Math.sqrt(sizes.reduce((s, v) => s + (v - m) ** 2, 0) / 2);
    expect(41 - m).toBeLessThan(1.5 * sd); // the naive rule would miss it
    const f = enrolmentFindings({
      classes: [cls("One", 25), cls("Two", 26), cls("Six", 41, 1)],
      total: 92, boys: 46, girls: 46, dobMissing: 0, religionMissing: 0,
    });
    expect(f.some((x) => x.key === "class-large-Six")).toBe(true);
  });

  it("names a genuinely oversized class, and says when it is unsplit", () => {
    const f = enrolmentFindings({
      classes: [cls("One", 25), cls("Two", 26), cls("Six", 41, 1)],
      total: 92, boys: 46, girls: 46, dobMissing: 0, religionMissing: 0,
    });
    const finding = f.find((x) => x.key === "class-large-Six");
    expect(finding).toBeDefined();
    expect(finding?.en).toContain("41 students");
    expect(finding?.en).toContain("unsplit");
  });

  it("reports a completeness gap as critical, with somewhere to go", () => {
    const f = enrolmentFindings({
      classes: [cls("One", 100)],
      total: 100, boys: 50, girls: 50, dobMissing: 40, religionMissing: 0,
    });
    const dob = f.find((x) => x.key === "dob-gap");
    expect(dob?.tone).toBe("critical");
    expect(dob?.href).toBe("/admin/student/update-basic");
  });

  /** A gender split is a fact about the school, not a defect in it. */
  it("reports a skewed roll neutrally", () => {
    const f = enrolmentFindings({
      classes: [cls("One", 100)],
      total: 100, boys: 20, girls: 80, dobMissing: 0, religionMissing: 0,
    });
    expect(f.find((x) => x.key === "gender-skew")?.tone).toBe("neutral");
  });
});

describe("academicFindings", () => {
  const sub = (name: string, appeared: number, failed: number, averagePct = 60) => ({
    name, appeared, failed, averagePct,
  });

  /**
   * The comparison is against the OTHER subjects. Against the overall rate a
   * subject dilutes its own outlier status — in a two-subject exam, almost
   * entirely — which is exactly the case a school with few subjects hits.
   */
  it("compares a subject against the others, not against a total it is inside", () => {
    const f = academicFindings({
      subjects: [sub("Mathematics", 100, 31), sub("Bangla", 100, 9), sub("English", 100, 9)],
      passRate: 85, appeared: 100,
    });
    const hard = f.find((x) => x.key === "subject-hard-Mathematics");
    expect(hard).toBeDefined();
    expect(hard?.en).toContain("31%");
    expect(hard?.en).toContain("9%");
    // The other two are not outliers against each other.
    expect(f.filter((x) => x.key.startsWith("subject-hard-"))).toHaveLength(1);
  });

  it("says nothing about difficulty when there is only one subject to compare", () => {
    const f = academicFindings({ subjects: [sub("Mathematics", 100, 90)], passRate: 10, appeared: 100 });
    expect(f.filter((x) => x.key.startsWith("subject-hard-"))).toHaveLength(0);
  });

  it("reports a strong pass rate as well as a weak one", () => {
    expect(academicFindings({ subjects: [], passRate: 97, appeared: 50 })[0]?.tone).toBe("positive");
    expect(academicFindings({ subjects: [], passRate: 55, appeared: 50 })[0]?.tone).toBe("critical");
  });

  /** No exam processed yet is not a finding about the students. */
  it("says nothing when nobody sat the exam", () => {
    expect(academicFindings({ subjects: [], passRate: null, appeared: 0 })).toEqual([]);
  });
});

describe("atRiskFindings", () => {
  it("turns an institution-wide balance into a phone list", () => {
    const arrears = [50000, 20000, 15000, ...Array.from({ length: 40 }, () => 500)];
    const f = atRiskFindings({ totalStudents: 268, atRisk: 43, multiSignal: 3, arrears, allSignalsAvailable: true });
    expect(f.find((x) => x.key === "arrears-concentration")?.en).toMatch(/sits with just \d+ students/);
  });

  it("confirms an empty register rather than rendering nothing", () => {
    const f = atRiskFindings({ totalStudents: 268, atRisk: 0, multiSignal: 0, arrears: [], allSignalsAvailable: true });
    expect(f).toHaveLength(1);
    expect(f[0].tone).toBe("positive");
  });

  /**
   * The reassurance has to be earned. With a signal switched off for want of
   * data, "no student crosses a threshold" is a claim about the DATA wearing
   * the students' clothes — and it is the most comforting sentence on the page.
   */
  it("withholds the clean bill of health when a signal could not be computed", () => {
    const f = atRiskFindings({ totalStudents: 268, atRisk: 0, multiSignal: 0, arrears: [], allSignalsAvailable: false });
    expect(f).toEqual([]);
  });

  /** An empty school has no good news to report either. */
  it("says nothing about a school with no students", () => {
    expect(atRiskFindings({ totalStudents: 0, atRisk: 0, multiSignal: 0, arrears: [], allSignalsAvailable: true })).toEqual([]);
  });
});
