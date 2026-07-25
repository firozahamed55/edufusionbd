/**
 * Year-end promotion is the most destructive write in the product — it re-enrols a
 * whole section and rewrites roll numbers, undoable only via
 * `fn_pushback_migration`. These are the guards that stop a lost UI selection from
 * being recorded as a completed promotion.
 */
import { describe, it, expect } from "vitest";
import { runMigrationSchema, studentBasicSchema } from "./api";

const YEAR = "11111111-1111-4111-8111-111111111111";
const SRC = "22222222-2222-4222-8222-222222222222";
const DST = "33333333-3333-4333-8333-333333333333";
const STU = "44444444-4444-4444-8444-444444444444";
const ENR = "55555555-5555-4555-8555-555555555555";

const base = {
  academic_year_id: YEAR,
  source_class_section_id: SRC,
  target_class_section_id: DST,
  type: "merit" as const,
  students: [{ student_id: STU, source_enrollment_id: ENR, merit_rank: 1 }],
};

describe("runMigrationSchema", () => {
  it("accepts a well-formed merit migration", () => {
    expect(runMigrationSchema.safeParse(base).success).toBe(true);
  });

  it("rejects an empty student list", () => {
    // Otherwise the RPC creates an empty batch marked 'completed', and the
    // migration history shows a promotion that never moved anybody.
    expect(runMigrationSchema.safeParse({ ...base, students: [] }).success).toBe(false);
  });

  it("rejects promoting a section into itself", () => {
    // Passes every DB constraint and produces duplicate enrolments.
    const r = runMigrationSchema.safeParse({ ...base, target_class_section_id: SRC });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toContain("target_class_section_id");
  });

  it("rejects an unknown migration type", () => {
    expect(runMigrationSchema.safeParse({ ...base, type: "promote" }).success).toBe(false);
  });

  it("rejects a non-positive merit rank", () => {
    expect(
      runMigrationSchema.safeParse({
        ...base,
        students: [{ student_id: STU, source_enrollment_id: ENR, merit_rank: 0 }],
      }).success,
    ).toBe(false);
  });
});

describe("studentBasicSchema", () => {
  const student = {
    id: STU, name_bn: "রফিক", name_en: "Rafiq", dob: "2011-04-02", gender: "male",
    blood_group: "B+", religion: "islam", birth_reg_no: "", nationality: "বাংলাদেশি",
    student_category_id: "",
  };

  it("accepts a partial record — a new admission has no birth reg. no. yet", () => {
    expect(studentBasicSchema.safeParse(student).success).toBe(true);
  });

  it("rejects a dd/mm/yyyy date of birth", () => {
    // The column is `date`; this either casts wrong or throws, on the field that
    // drives age reports and exam eligibility.
    expect(studentBasicSchema.safeParse({ ...student, dob: "02/04/2011" }).success).toBe(false);
  });

  it("accepts an empty date of birth", () => {
    expect(studentBasicSchema.safeParse({ ...student, dob: "" }).success).toBe(true);
  });

  it("rejects a name long enough to be a paste accident", () => {
    expect(studentBasicSchema.safeParse({ ...student, name_en: "x".repeat(200) }).success).toBe(false);
  });
});
