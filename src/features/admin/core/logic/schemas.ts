import { z } from "zod";
import { isoDate, optionalBdMobile, optionalText, shortText, uuid } from "@/shared/lib/validation";

/**
 * Validation for the Settings module (audit M-7).
 *
 * WHY IT MATTERS MORE HERE THAN ANYWHERE ELSE. Two of eleven Settings screens
 * validated anything beyond "name required". Everywhere else the contract was a
 * toast. Invalid configuration is not a local bug — it is upstream of exam
 * processing, certificate printing and fee scheduling. `pass_marks > full_marks`
 * produces a cohort with zero passes, and it surfaces six weeks later on the
 * results screen, where it is diagnosed as a results bug. The failure moves
 * from "wrong results in week 6" to "red field in second 3".
 *
 * THE CLIENT IS UX; THE DATABASE IS THE CONTROL. Every rule below that can be
 * expressed server-side also is (migration `20260808130000`). A zod parse is
 * bypassable with the anon key and curl. Do not delete a server check because a
 * client check now exists.
 *
 * A NOTE ON NUMBERS. Forms hold strings — an `<input type="number">` still
 * produces a string, and `""` for empty. Every numeric field is therefore
 * declared as a string with a coercion, not as `z.number()`, so the schema
 * describes what the form actually holds.
 */

const blank = (v: unknown) => v === "" || v === null || v === undefined;

/** A required integer field, held as the string the input produces. */
const intField = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .refine((v) => !blank(v), message)
    .refine((v) => /^-?\d+$/.test(v), message)
    .refine((v) => Number(v) >= min && Number(v) <= max, message);

/** The same, but a blank is allowed and means "not set". */
const optionalIntField = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .refine((v) => blank(v) || (/^-?\d+$/.test(v) && Number(v) >= min && Number(v) <= max), message);

/* ------------------------------------------------------------- 2.2 StartUp */

const CURRENT_YEAR = 2026;

/**
 * Institution identity. This data prints on every certificate and is submitted
 * to the board, and until now every field on the screen accepted anything at
 * all: an EIIN of any shape, `not-an-email`, `established_year = 99999`.
 */
export const startupSchema = z
  .object({
    name_bn: shortText(160).min(2, "প্রতিষ্ঠানের বাংলা নাম দিন / Enter the Bangla name"),
    name_en: shortText(160).min(2, "Enter the English name"),
    /** Six digits. The board issues no other shape. */
    eiin: z
      .string()
      .trim()
      .refine((v) => blank(v) || /^\d{6}$/.test(v), "EIIN is 6 digits"),
    institution_code: optionalText(40),
    institution_type: optionalText(30),
    established_year: optionalIntField(1800, CURRENT_YEAR, `Founding year must be between 1800 and ${CURRENT_YEAR}`),
    board_id: z.string().trim(),
    mpo_status: optionalText(20),
    phone: optionalBdMobile,
    email: z
      .string()
      .trim()
      .refine((v) => blank(v) || z.string().email().safeParse(v).success, "Enter a valid email address"),
    website: z
      .string()
      .trim()
      .refine(
        (v) => blank(v) || /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(\/\S*)?$/i.test(v),
        "Enter a valid website address",
      ),
    address: optionalText(400),
    head_teacher_id: z.string().trim(),
  })
  .transform((v) => ({ ...v, established_year: v.established_year || "" }));

export type StartupValues = {
  name_bn: string; name_en: string; eiin: string; institution_code: string;
  institution_type: string; established_year: string; board_id: string; mpo_status: string;
  phone: string; email: string; website: string; address: string; head_teacher_id: string;
};

/* ------------------------------------------------------------- 2.3 Class */

export const classSchema = z
  .object({
    id: z.string(),
    name_bn: shortText(80).min(1, "নাম আবশ্যক / Name required"),
    name_en: shortText(80).min(1, "Name required"),
    numeric_level: optionalIntField(1, 20, "Numeric level must be between 1 and 20"),
    /**
     * Levels already taken by OTHER classes. Two classes at level 9 make
     * ordering ambiguous everywhere the level is used — the class list, the
     * subject applicability range, promotion. Passed in because the schema
     * cannot know the roster.
     */
    takenLevels: z.array(z.number()).default([]),
  })
  .refine(
    (v) => blank(v.numeric_level) || !v.takenLevels.includes(Number(v.numeric_level)),
    { path: ["numeric_level"], message: "Another class already uses this level" },
  );

export const sectionSchema = z
  .object({
    id: z.string(),
    section_name: shortText(20).min(1, "Section name required"),
    capacity: optionalIntField(1, 500, "Capacity must be between 1 and 500"),
    class_teacher_id: z.string().trim(),
    /** Students already enrolled in this section, if it exists. */
    enrolled: z.number().default(0),
  })
  .refine((v) => blank(v.capacity) || Number(v.capacity) >= v.enrolled, {
    path: ["capacity"],
    // A capacity below the current roll is accepted by the database and then
    // reports permanent over-subscription with no way to explain it.
    message: "Capacity cannot be below the number already enrolled",
  });

/* ------------------------------------------------------------ 2.6 Subject */

export const subjectSchema = z
  .object({
    id: z.string(),
    name_bn: shortText(80).min(1, "নাম আবশ্যক / Name required"),
    name_en: shortText(80).min(1, "Name required"),
    code: optionalText(24),
    type: z.enum(["compulsory", "optional"]),
    full_marks: intField(1, 1000, "Full marks must be between 1 and 1000"),
    pass_marks: intField(0, 1000, "Pass marks must be between 0 and 1000"),
    min_class_level: optionalIntField(1, 20, "Not a valid class level"),
    max_class_level: optionalIntField(1, 20, "Not a valid class level"),
    status: z.enum(["active", "inactive"]),
    /** Codes held by OTHER subjects, for the uniqueness check. */
    takenCodes: z.array(z.string()).default([]),
  })
  .refine((v) => Number(v.pass_marks) <= Number(v.full_marks), {
    path: ["pass_marks"],
    // The defect this prevents: a cohort with zero passes, diagnosed six weeks
    // later on the results screen as a results bug.
    message: "Pass marks cannot exceed full marks",
  })
  .refine(
    (v) =>
      blank(v.min_class_level) || blank(v.max_class_level) ||
      Number(v.min_class_level) <= Number(v.max_class_level),
    { path: ["max_class_level"], message: "The last class must not come before the first" },
  )
  .refine(
    (v) => blank(v.code) || !v.takenCodes.includes(v.code.trim().toUpperCase()),
    { path: ["code"], message: "Another subject already uses this code" },
  );

/* ------------------------------------------------------ 2.7 Subject group */

export const subjectGroupSchema = z
  .object({
    id: z.string(),
    name: shortText(80).min(1, "Group name required"),
    name_bn: optionalText(80),
    /**
     * A group with zero subjects saves happily and then renders "No subjects" —
     * a valid-looking record that does nothing, and a silent no-op in elective
     * assignment.
     */
    subject_ids: z.array(uuid).min(1, "Choose at least one subject"),
    /**
     * Which of those subjects are the elective pool (audit S-7.6). "Choose 1 of
     * Higher Math / Biology / Agriculture" is the most common rule in a
     * Bangladeshi school and the old model could not express it at all — every
     * subject in a group was equally, silently compulsory.
     */
    elective_ids: z.array(uuid).default([]),
    /**
     * How many of the pool a student takes. Blank = no elective rule.
     *
     * `.default("")` because this is a string field over a `<input type=number>`
     * and an absent key is a legitimate caller (a group created before the
     * elective model existed). Without it a missing key fails `.trim()` and the
     * whole parse reports as "group name required", which is a lie.
     */
    elective_pick: optionalIntField(1, 10, "Students pick between 1 and 10 subjects").default(""),
    /**
     * The classes this group applies to (audit S-7.5). A "Science" group means
     * nothing until it is attached to classes 9 and 10, and that relationship
     * was absent from the product entirely.
     */
    class_ids: z.array(uuid).default([]),
    takenNames: z.array(z.string()).default([]),
  })
  .refine((v) => !v.takenNames.includes(v.name.trim().toLowerCase()), {
    path: ["name"],
    message: "A group with this name already exists",
  })
  .refine(
    (v) => blank(v.elective_pick) || Number(v.elective_pick) <= v.elective_ids.length,
    {
      path: ["elective_pick"],
      // "Pick 3 of 2" is a rule no student can satisfy, and it would surface at
      // enrolment as an unexplainable failure rather than here as a typo.
      message: "That is more subjects than are marked elective",
    },
  )
  .refine((v) => v.elective_ids.every((id) => v.subject_ids.includes(id)), {
    path: ["elective_ids"],
    message: "An elective must also be a subject in the group",
  });

/* ---------------------------------------------------------- 2.8 Grading */

/** Band-level rules. Range coverage stays in `validateGradeScale`, which is
 *  tested and correct; this adds what it does not cover. */
export const gradeSchemeSchema = z.object({
  id: z.string(),
  name: shortText(60).min(1, "Scheme name required"),
  is_default: z.boolean(),
  scales: z
    .array(
      z.object({
        grade_letter: z.string().trim().min(1, "Every band needs a letter").max(4),
        gpa_point: z.number().min(0, "GPA cannot be negative").max(10, "GPA above 10 is not a grade point"),
        min_marks: z.number().int().min(0).max(100),
        max_marks: z.number().int().min(0).max(100),
      }),
    )
    .min(1, "A scheme needs at least one band"),
});

/* ---------------------------------------------------------- 2.4 Calendar */

export const calendarRangeSchema = z
  .object({
    from: isoDate,
    to: z.string().trim(),
    label: z.string().trim(),
    working: z.boolean(),
  })
  .refine((v) => blank(v.to) || v.to >= v.from, {
    path: ["to"],
    // `min` on the input is a hint a paste or a script walks straight past, and
    // an inverted range marks nothing while reporting success.
    message: "The end date cannot be before the start date",
  })
  .refine(
    (v) => {
      if (blank(v.to)) return true;
      const days = (Date.parse(`${v.to}T00:00:00Z`) - Date.parse(`${v.from}T00:00:00Z`)) / 86_400_000;
      return days <= 366;
    },
    { path: ["to"], message: "A single range cannot span more than a year" },
  )
  .refine((v) => v.working || v.label.trim().length > 0, {
    path: ["label"],
    message: "A holiday needs a name — an unexplained gap in the register is what an inspector asks about",
  });

export const termSchema = z
  .object({
    id: z.string(),
    name_en: shortText(60).min(1, "Name required"),
    name_bn: optionalText(60),
    start_date: z.string().trim(),
    end_date: z.string().trim(),
    is_current: z.boolean(),
    /** Other terms in the same year, for the overlap check. */
    others: z.array(z.object({ start: z.string().nullable(), end: z.string().nullable(), name: z.string() })).default([]),
  })
  .refine((v) => blank(v.start_date) || blank(v.end_date) || v.end_date >= v.start_date, {
    path: ["end_date"],
    message: "The end date cannot be before the start date",
  })
  .refine(
    (v) => {
      if (blank(v.start_date) || blank(v.end_date)) return true;
      // Two terms covering the same day make "which term is this mark in"
      // unanswerable, and the marksheet picks one arbitrarily.
      return !v.others.some(
        (o) => o.start && o.end && v.start_date <= o.end && v.end_date >= o.start,
      );
    },
    { path: ["start_date"], message: "These dates overlap another term" },
  );

/* --------------------------------------------------------- 2.5 Signature */

export const signatureSchema = z.object({
  role_label: shortText(60).min(1, "Role required"),
  holder_name: shortText(120).min(2, "Enter the signatory's name"),
});

/* ---------------------------------------------- 2.1 Basic Config coherence */

const WORKING_DAY_SET: Record<string, number[]> = {
  // 0 = Sunday, matching `Date#getUTCDay`.
  sun_thu: [0, 1, 2, 3, 4],
  sat_thu: [6, 0, 1, 2, 3, 4],
  mon_fri: [1, 2, 3, 4, 5],
};
const WEEKEND_SET: Record<string, number[]> = {
  fri_sat: [5, 6],
  sat_sun: [6, 0],
  fri_only: [5],
};

/**
 * The one cross-field rule `NUMERIC_RULES` cannot express (audit S-1.10).
 *
 * `working_days` and `weekend` are two independent selects over the same seven
 * days, and nothing checked that they agree: a Sun–Thu working week with a
 * Sat–Sun weekend is accepted, and Sunday is then simultaneously a teaching day
 * and a holiday. Attendance and the calendar read different halves of that
 * contradiction.
 *
 * Returns the overlapping days, or an empty array when the pair is coherent.
 */
export function weekendConflict(workingDays: unknown, weekend: unknown): number[] {
  const work = WORKING_DAY_SET[String(workingDays ?? "")];
  const off = WEEKEND_SET[String(weekend ?? "")];
  if (!work || !off) return [];
  return work.filter((d) => off.includes(d));
}
