import { describe, expect, it } from "vitest";
import {
  calendarRangeSchema, classSchema, gradeSchemeSchema, sectionSchema, signatureSchema,
  startupSchema, subjectGroupSchema, subjectSchema, termSchema, weekendConflict,
} from "./schemas";

/**
 * Phase 2's per-screen validation gate (settings audit M-7).
 *
 * Each block is the concrete bad input the product used to ACCEPT, named in the
 * audit, plus the good input beside it — because a rule that rejects everything
 * passes a one-sided test and breaks the screen.
 */

const ok = <T,>(r: { success: boolean; data?: T }) => r.success;
/** The message on a given field, or undefined. Mirrors what `Field` renders. */
function errOn(result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }, key: string) {
  if (result.success || !result.error) return undefined;
  return result.error.issues.find((i) => String(i.path[0]) === key)?.message;
}

/* ------------------------------------------------------------------ StartUp */

const STARTUP = {
  name_bn: "গ্রীন ভ্যালি স্কুল", name_en: "Green Valley School", eiin: "123456",
  institution_code: "GVS-2026", institution_type: "school", established_year: "1998",
  board_id: "", mpo_status: "mpo", phone: "01712345678", email: "office@gvs.edu.bd",
  website: "gvs.edu.bd", address: "Dhaka", head_teacher_id: "",
};

describe("startupSchema", () => {
  it("accepts a fully filled institution", () => {
    expect(ok(startupSchema.safeParse(STARTUP))).toBe(true);
  });

  it("rejects an EIIN that is not six digits", () => {
    expect(errOn(startupSchema.safeParse({ ...STARTUP, eiin: "12345" }), "eiin")).toBe("EIIN is 6 digits");
    expect(errOn(startupSchema.safeParse({ ...STARTUP, eiin: "abcdef" }), "eiin")).toBeDefined();
  });

  it("allows a blank EIIN — a coaching centre has none", () => {
    expect(ok(startupSchema.safeParse({ ...STARTUP, eiin: "" }))).toBe(true);
  });

  it("rejects `not-an-email`, which the screen used to accept", () => {
    expect(errOn(startupSchema.safeParse({ ...STARTUP, email: "not-an-email" }), "email")).toBeDefined();
  });

  it("rejects established_year = 99999", () => {
    expect(errOn(startupSchema.safeParse({ ...STARTUP, established_year: "99999" }), "established_year")).toBeDefined();
  });

  it("rejects a phone that is not a Bangladesh mobile", () => {
    expect(errOn(startupSchema.safeParse({ ...STARTUP, phone: "12345" }), "phone")).toBeDefined();
  });

  it("accepts a website with or without a scheme", () => {
    expect(ok(startupSchema.safeParse({ ...STARTUP, website: "https://gvs.edu.bd/about" }))).toBe(true);
    expect(errOn(startupSchema.safeParse({ ...STARTUP, website: "not a site" }), "website")).toBeDefined();
  });
});

/* -------------------------------------------------------------------- Class */

const CLASS = { id: "", name_bn: "ষষ্ঠ", name_en: "Six", numeric_level: "6", takenLevels: [] as number[] };

describe("classSchema", () => {
  it("accepts a class at a free level", () => {
    expect(ok(classSchema.safeParse(CLASS))).toBe(true);
  });

  it("rejects a numeric level another class already holds", () => {
    // Two classes at level 9 make ordering ambiguous everywhere it is used.
    expect(errOn(classSchema.safeParse({ ...CLASS, numeric_level: "9", takenLevels: [9] }), "numeric_level")).toBeDefined();
  });

  it("rejects a level outside 1–20", () => {
    expect(errOn(classSchema.safeParse({ ...CLASS, numeric_level: "0" }), "numeric_level")).toBeDefined();
    expect(errOn(classSchema.safeParse({ ...CLASS, numeric_level: "21" }), "numeric_level")).toBeDefined();
  });
});

describe("sectionSchema", () => {
  const SECTION = { id: "s1", section_name: "A", capacity: "50", class_teacher_id: "", enrolled: 45 };

  it("accepts a capacity at or above the current roll", () => {
    expect(ok(sectionSchema.safeParse(SECTION))).toBe(true);
    expect(ok(sectionSchema.safeParse({ ...SECTION, capacity: "45" }))).toBe(true);
  });

  it("rejects a capacity below the students already enrolled", () => {
    // Accepted before, and the table then reported permanent over-subscription
    // with no way to explain it.
    expect(errOn(sectionSchema.safeParse({ ...SECTION, capacity: "20" }), "capacity")).toBeDefined();
  });
});

/* ------------------------------------------------------------------ Subject */

const SUBJECT = {
  id: "", name_bn: "বাংলা", name_en: "Bangla", code: "BAN-101", type: "compulsory" as const,
  full_marks: "100", pass_marks: "33", min_class_level: "6", max_class_level: "10",
  status: "active" as const, takenCodes: [] as string[],
};

describe("subjectSchema", () => {
  it("accepts a well-formed subject", () => {
    expect(ok(subjectSchema.safeParse(SUBJECT))).toBe(true);
  });

  it("rejects pass_marks above full_marks — a subject nobody can pass", () => {
    expect(errOn(subjectSchema.safeParse({ ...SUBJECT, pass_marks: "120" }), "pass_marks")).toBeDefined();
  });

  it("rejects negative marks", () => {
    expect(errOn(subjectSchema.safeParse({ ...SUBJECT, full_marks: "-1" }), "full_marks")).toBeDefined();
  });

  it("rejects min_class_level above max_class_level — applicable to no class", () => {
    expect(errOn(subjectSchema.safeParse({ ...SUBJECT, min_class_level: "10", max_class_level: "6" }), "max_class_level")).toBeDefined();
  });

  it("rejects a code another subject already uses, case-insensitively", () => {
    expect(errOn(subjectSchema.safeParse({ ...SUBJECT, code: "ban-101", takenCodes: ["BAN-101"] }), "code")).toBeDefined();
  });

  it("allows the same subject to keep its own code on edit", () => {
    expect(ok(subjectSchema.safeParse({ ...SUBJECT, takenCodes: ["ENG-101"] }))).toBe(true);
  });
});

/* ------------------------------------------------------------ Subject group */

const UUID_A = "11111111-1111-4111-8111-111111111111";

describe("subjectGroupSchema", () => {
  const GROUP = { id: "", name: "Science", name_bn: "বিজ্ঞান", subject_ids: [UUID_A], takenNames: [] as string[] };

  it("accepts a named group with at least one subject", () => {
    expect(ok(subjectGroupSchema.safeParse(GROUP))).toBe(true);
  });

  it("rejects a group with no subjects — a valid-looking row that does nothing", () => {
    expect(errOn(subjectGroupSchema.safeParse({ ...GROUP, subject_ids: [] }), "subject_ids")).toBeDefined();
  });

  it("rejects a duplicate group name", () => {
    expect(errOn(subjectGroupSchema.safeParse({ ...GROUP, takenNames: ["science"] }), "name")).toBeDefined();
  });
});

/* ------------------------------------------------------------------ Grading */

describe("gradeSchemeSchema", () => {
  const BAND = { grade_letter: "A+", gpa_point: 5, min_marks: 80, max_marks: 100 };
  const SCHEME = { id: "", name: "GPA 5.0", is_default: true, scales: [BAND] };

  it("accepts a named scheme with bands", () => {
    expect(ok(gradeSchemeSchema.safeParse(SCHEME))).toBe(true);
  });

  it("rejects a negative GPA", () => {
    expect(ok(gradeSchemeSchema.safeParse({ ...SCHEME, scales: [{ ...BAND, gpa_point: -1 }] }))).toBe(false);
  });

  it("rejects a GPA above any real scale", () => {
    expect(ok(gradeSchemeSchema.safeParse({ ...SCHEME, scales: [{ ...BAND, gpa_point: 50 }] }))).toBe(false);
  });

  it("rejects a scheme with no bands at all", () => {
    expect(ok(gradeSchemeSchema.safeParse({ ...SCHEME, scales: [] }))).toBe(false);
  });
});

/* ----------------------------------------------------------------- Calendar */

describe("calendarRangeSchema", () => {
  const RANGE = { from: "2026-04-08", to: "2026-04-14", label: "Eid-ul-Fitr", working: false };

  it("accepts a labelled holiday range", () => {
    expect(ok(calendarRangeSchema.safeParse(RANGE))).toBe(true);
  });

  it("accepts a single day — a blank `to`", () => {
    expect(ok(calendarRangeSchema.safeParse({ ...RANGE, to: "" }))).toBe(true);
  });

  it("rejects an inverted range, which `min=` on the input never caught", () => {
    expect(errOn(calendarRangeSchema.safeParse({ ...RANGE, from: "2026-04-14", to: "2026-04-08" }), "to")).toBeDefined();
  });

  it("rejects a range longer than a year — a mistyped year, not an intention", () => {
    expect(errOn(calendarRangeSchema.safeParse({ ...RANGE, to: "2028-04-14" }), "to")).toBeDefined();
  });

  it("requires a name on a holiday but not on a working day", () => {
    expect(errOn(calendarRangeSchema.safeParse({ ...RANGE, label: "" }), "label")).toBeDefined();
    expect(ok(calendarRangeSchema.safeParse({ ...RANGE, label: "", working: true }))).toBe(true);
  });
});

describe("termSchema", () => {
  const TERM = {
    id: "", name_en: "1st Term", name_bn: "১ম সাময়িক",
    start_date: "2026-01-01", end_date: "2026-04-30", is_current: true,
    others: [] as { start: string | null; end: string | null; name: string }[],
  };

  it("accepts a term that clears every other term", () => {
    expect(ok(termSchema.safeParse({ ...TERM, others: [{ start: "2026-05-01", end: "2026-08-31", name: "2nd Term" }] }))).toBe(true);
  });

  it("rejects an end date before the start date", () => {
    expect(errOn(termSchema.safeParse({ ...TERM, end_date: "2025-12-01" }), "end_date")).toBeDefined();
  });

  it("rejects a term overlapping another — 'which term is this mark in' must have one answer", () => {
    const clash = termSchema.safeParse({ ...TERM, others: [{ start: "2026-04-01", end: "2026-08-31", name: "2nd Term" }] });
    expect(errOn(clash, "start_date")).toBeDefined();
  });

  it("ignores other terms with no dates set", () => {
    expect(ok(termSchema.safeParse({ ...TERM, others: [{ start: null, end: null, name: "Draft" }] }))).toBe(true);
  });
});

/* ---------------------------------------------------------------- Signature */

describe("signatureSchema", () => {
  it("rejects a blank holder name — a blank signature block on a certificate", () => {
    expect(ok(signatureSchema.safeParse({ role_label: "head_teacher", holder_name: "" }))).toBe(false);
  });

  it("accepts a real name", () => {
    expect(ok(signatureSchema.safeParse({ role_label: "head_teacher", holder_name: "Md. Rahim Uddin" }))).toBe(true);
  });
});

/* ------------------------------------------------------- Basic Config S-1.10 */

describe("weekendConflict", () => {
  it("reports no conflict for the Bangladeshi default", () => {
    // Sun–Thu teaching, Fri–Sat off: the two selects agree.
    expect(weekendConflict("sun_thu", "fri_sat")).toEqual([]);
  });

  it("catches Sunday being both a teaching day and a weekend", () => {
    // Accepted before, and attendance read one half of the contradiction while
    // the calendar read the other.
    expect(weekendConflict("sun_thu", "sat_sun")).toEqual([0]);
  });

  it("catches a Sat–Thu week against a Fri–Sat weekend", () => {
    expect(weekendConflict("sat_thu", "fri_sat")).toEqual([6]);
  });

  it("returns nothing when either value is unset, rather than a false alarm", () => {
    expect(weekendConflict(undefined, "fri_sat")).toEqual([]);
    expect(weekendConflict("sun_thu", null)).toEqual([]);
  });
});
