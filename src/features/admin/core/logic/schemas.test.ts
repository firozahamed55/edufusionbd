import { describe, it, expect } from "vitest";
import {
  startupSchema,
  subjectSchema,
  classSchema,
  classSectionSchema,
  subjectGroupSchema,
  calendarRangeSchema,
  termSchema,
  gradeSchemeSchema,
  weekendConflict,
  signatureSchema,
  MAX_RANGE_DAYS,
} from "./schemas";

/**
 * Settings audit M-7 — Phase 2 QA, one block per screen.
 *
 * Each case is an input the product ACCEPTED before this schema existed, taken
 * from the audit's own table of accepted-invalid inputs (§1, M-7). The
 * assertion is not "zod works"; it is "this specific defect is now
 * unrepresentable".
 */

const firstError = (result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
  result.success ? null : (result.error?.issues[0]?.path[0] ?? null);

/* ------------------------------------------------------------------ StartUp */

describe("StartUp (S-2.1)", () => {
  const valid = {
    name_bn: "গ্রাম উচ্চ বিদ্যালয়",
    name_en: "Gram High School",
    eiin: "123456",
    established_year: "1985",
    phone: "01712345678",
    email: "office@school.edu.bd",
    website: "https://school.edu.bd",
  };

  it("accepts a fully filled, correct identity", () => {
    expect(startupSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts blanks in every optional field — the RPC reads '' as absent", () => {
    const parsed = startupSchema.safeParse({
      name_bn: "ক", name_en: "K",
      eiin: "", established_year: "", phone: "", email: "", website: "", address: "",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an EIIN of any shape but six digits", () => {
    for (const eiin of ["12345", "1234567", "12345a", "EIIN-123456"]) {
      expect(startupSchema.safeParse({ ...valid, eiin }).success, eiin).toBe(false);
    }
  });

  it("rejects established_year = 99999, which used to reach the board submission", () => {
    expect(startupSchema.safeParse({ ...valid, established_year: "99999" }).success).toBe(false);
    expect(startupSchema.safeParse({ ...valid, established_year: "1799" }).success).toBe(false);
    // Next year is not a founding year.
    const next = String(new Date().getFullYear() + 1);
    expect(startupSchema.safeParse({ ...valid, established_year: next }).success).toBe(false);
  });

  it("rejects `not-an-email` and a bare-word website", () => {
    expect(firstError(startupSchema.safeParse({ ...valid, email: "not-an-email" }))).toBe("email");
    expect(firstError(startupSchema.safeParse({ ...valid, website: "school.edu.bd" }))).toBe("website");
  });

  it("rejects a website whose scheme is not http(s) — the value is rendered as a link", () => {
    expect(startupSchema.safeParse({ ...valid, website: "javascript:alert(1)" }).success).toBe(false);
    expect(startupSchema.safeParse({ ...valid, website: "mailto:a@b.com" }).success).toBe(false);
  });

  it("rejects a phone that is not a Bangladeshi mobile", () => {
    expect(startupSchema.safeParse({ ...valid, phone: "0212345678" }).success).toBe(false);
  });
});

/* ------------------------------------------------------------------ Subject */

describe("Subject (S-6.1, S-6.5)", () => {
  const valid = {
    name_bn: "বাংলা", name_en: "Bangla", code: "BAN-101", type: "compulsory",
    full_marks: "100", pass_marks: "33", min_class_level: "6", max_class_level: "10", status: "active",
  };

  it("accepts a normal subject", () => {
    expect(subjectSchema().safeParse(valid).success).toBe(true);
  });

  it("blocks a subject nobody can pass, and blames the pass-marks field", () => {
    const r = subjectSchema().safeParse({ ...valid, pass_marks: "120" });
    expect(r.success).toBe(false);
    expect(firstError(r)).toBe("pass_marks");
  });

  it("blocks a subject applicable to no class", () => {
    const r = subjectSchema().safeParse({ ...valid, min_class_level: "10", max_class_level: "6" });
    expect(firstError(r)).toBe("max_class_level");
  });

  it("blocks negative and absurd marks", () => {
    expect(subjectSchema().safeParse({ ...valid, full_marks: "-1" }).success).toBe(false);
    expect(subjectSchema().safeParse({ ...valid, full_marks: "1001" }).success).toBe(false);
  });

  it("blocks a duplicate code, case- and space-insensitively", () => {
    const schema = subjectSchema(["BAN-101", "ENG-101"]);
    expect(schema.safeParse({ ...valid, code: " ban-101 " }).success).toBe(false);
    expect(schema.safeParse({ ...valid, code: "MAT-101" }).success).toBe(true);
  });

  it("allows equal pass and full marks — a 1-mark viva is not a mistake", () => {
    expect(subjectSchema().safeParse({ ...valid, full_marks: "50", pass_marks: "50" }).success).toBe(true);
  });
});

/* --------------------------------------------------------------------- Class */

describe("Class Config (S-3.2, S-3.3)", () => {
  it("blocks a second class at the same numeric level", () => {
    const schema = classSchema([6, 7, 8]);
    expect(schema.safeParse({ name_bn: "ষষ্ঠ", name_en: "Six", numeric_level: "6" }).success).toBe(false);
    expect(schema.safeParse({ name_bn: "নবম", name_en: "Nine", numeric_level: "9" }).success).toBe(true);
  });

  it("ignores classes whose level is not set when checking uniqueness", () => {
    expect(classSchema([null, null]).safeParse({ name_bn: "ক", name_en: "K", numeric_level: "9" }).success).toBe(true);
  });

  it("blocks a section capacity below the students already in it", () => {
    const schema = classSectionSchema(45);
    const base = { section_id: "3f2504e0-4f89-11d3-9a0c-0305e82c3301" };
    expect(schema.safeParse({ ...base, capacity: "20" }).success).toBe(false);
    expect(schema.safeParse({ ...base, capacity: "50" }).success).toBe(true);
  });

  it("blocks a capacity of zero", () => {
    const schema = classSectionSchema(0);
    expect(schema.safeParse({ section_id: "3f2504e0-4f89-11d3-9a0c-0305e82c3301", capacity: "0" }).success).toBe(false);
  });
});

/* ------------------------------------------------------------- Subject Group */

describe("Subject Group (S-7.1, S-7.2)", () => {
  const id = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";

  it("blocks a group with no subjects — it saved, then rendered 'No subjects'", () => {
    const r = subjectGroupSchema().safeParse({ name: "Science", subject_ids: [] });
    expect(firstError(r)).toBe("subject_ids");
  });

  it("blocks a duplicate group name", () => {
    expect(subjectGroupSchema(["Science"]).safeParse({ name: " science ", subject_ids: [id] }).success).toBe(false);
  });

  it("accepts the new optional Bangla name", () => {
    const parsed = subjectGroupSchema().parse({ name: "Science", name_bn: "বিজ্ঞান", subject_ids: [id] });
    expect(parsed.name_bn).toBe("বিজ্ঞান");
  });
});

/* ------------------------------------------------------------------ Calendar */

describe("Academic Calendar (S-4.3, S-4.9)", () => {
  const base = { label: "Eid", is_working_day: false };

  it("blocks a range that ends before it starts — the `min` attribute is not a check", () => {
    const r = calendarRangeSchema.safeParse({ ...base, from: "2026-04-10", to: "2026-04-01" });
    expect(firstError(r)).toBe("to");
  });

  it("accepts a single-day range", () => {
    expect(calendarRangeSchema.safeParse({ ...base, from: "2026-04-10", to: "2026-04-10" }).success).toBe(true);
  });

  it(`blocks a range longer than ${MAX_RANGE_DAYS} days`, () => {
    expect(calendarRangeSchema.safeParse({ ...base, from: "2026-01-01", to: "2027-12-31" }).success).toBe(false);
  });

  const year = { start_date: "2026-01-01", end_date: "2026-12-31" };
  const terms = [{ id: "t1", name: "First Term", start_date: "2026-01-01", end_date: "2026-04-30" }];

  it("blocks a term that starts before the academic year", () => {
    const r = termSchema(terms, year).safeParse({
      name: "Pre", start_date: "2025-12-01", end_date: "2026-01-31", is_current: false,
    });
    expect(r.success).toBe(false);
  });

  it("blocks a term that overlaps another, and names the one it clashes with", () => {
    const r = termSchema(terms, year).safeParse({
      name: "Second Term", start_date: "2026-04-15", end_date: "2026-08-31", is_current: false,
    });
    expect(r.success).toBe(false);
    expect(r.success ? "" : r.error.issues[0].message).toContain("First Term");
  });

  it("does not treat a term as overlapping itself while being edited", () => {
    const r = termSchema(terms, year, "t1").safeParse({
      name: "First Term", start_date: "2026-01-01", end_date: "2026-05-31", is_current: true,
    });
    expect(r.success).toBe(true);
  });

  it("skips the containment rule when the academic year has not loaded", () => {
    const r = termSchema([], undefined).safeParse({
      name: "Any", start_date: "2019-01-01", end_date: "2019-06-30", is_current: false,
    });
    expect(r.success).toBe(true);
  });
});

/* ------------------------------------------------------------------- Grading */

describe("Grading Scheme (S-8.7)", () => {
  const band = { grade_letter: "A+", gpa_point: "5", min_marks: "80", max_marks: "100" };

  it("accepts a normal band", () => {
    expect(gradeSchemeSchema().safeParse({ name: "SSC", is_default: true, scales: [band] }).success).toBe(true);
  });

  it("blocks a negative GPA and a GPA above the scheme maximum", () => {
    for (const gpa_point of ["-1", "9"]) {
      const r = gradeSchemeSchema().safeParse({ name: "SSC", is_default: false, scales: [{ ...band, gpa_point }] });
      expect(r.success, gpa_point).toBe(false);
    }
  });

  it("blocks a scheme with no bands at all", () => {
    expect(gradeSchemeSchema().safeParse({ name: "SSC", is_default: false, scales: [] }).success).toBe(false);
  });

  it("blocks a duplicate scheme name", () => {
    expect(gradeSchemeSchema(["SSC"]).safeParse({ name: "ssc", is_default: false, scales: [band] }).success).toBe(false);
  });
});

/* -------------------------------------------------------------- Basic Config */

describe("Basic Config weekend consistency (S-1.10)", () => {
  it("catches a working week that overlaps the weekend", () => {
    // Sun–Thu working, Sat–Sun weekend: Sunday is both.
    expect(weekendConflict("sun_thu", "sat_sun")).toEqual([0]);
    // Sat–Thu working, Fri–Sat weekend: Saturday is both.
    expect(weekendConflict("sat_thu", "fri_sat")).toEqual([6]);
  });

  it("passes the two combinations a Bangladeshi school actually uses", () => {
    expect(weekendConflict("sun_thu", "fri_sat")).toEqual([]);
    expect(weekendConflict("sat_thu", "fri_only")).toEqual([]);
  });

  it("says nothing when either half is unset — that is incomplete, not contradictory", () => {
    expect(weekendConflict("", "fri_sat")).toEqual([]);
    expect(weekendConflict("sun_thu", undefined)).toEqual([]);
  });
});

/* ----------------------------------------------------------------- Signature */

describe("Signature", () => {
  it("blocks an empty holder name — the certificate would print a bare line", () => {
    expect(signatureSchema.safeParse({ role_label: "Head Teacher", holder_name: "" }).success).toBe(false);
    expect(signatureSchema.safeParse({ role_label: "Head Teacher", holder_name: "R. Khatun" }).success).toBe(true);
  });
});
