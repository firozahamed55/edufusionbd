import { z } from "zod";
import { optionalBdMobile, optionalText, optionalUuid, shortText, uuid } from "@/shared/lib/validation";

/**
 * Validation for the Settings module (audit M-7).
 *
 * Two of eleven screens validated anything. The product accepted an EIIN of any
 * shape, `not-an-email`, `established_year = 99999`, a subject whose pass mark
 * exceeds its full mark, a class capacity below the number of students already
 * in it, a subject group with no subjects, and a date range ending before it
 * begins. None of those is a local bug: Settings is upstream of exam
 * processing, certificate printing and fee scheduling, so `pass_marks >
 * full_marks` surfaces six weeks later in the results screen and is diagnosed
 * as a results bug.
 *
 * ONE MODULE, NOT ELEVEN FILES. The audit says "logic/schemas.ts per screen".
 * These schemas share their primitives — every one of them needs the same
 * "a form holds '' where the RPC wants null" bridge, and four need the same
 * marks bounds — and eleven files would either duplicate that or import a
 * twelfth. Grouped by screen with a heading each, which is what the per-screen
 * split was for.
 *
 * THE CLIENT IS UX; THE DATABASE IS THE CONTROL. Nothing here replaces a CHECK
 * constraint or an RPC guard, and the corresponding server-side rules are added
 * in `20260801182000_settings_validation.sql`. A schema that is the only thing
 * standing between a form and the table is not validation, it is a suggestion.
 */

/* ------------------------------------------------------------- primitives */

const currentYear = () => new Date().getFullYear();

/**
 * A number the form holds as a string.
 *
 * Every numeric `<input>` in this app is bound to a string, and `z.number()`
 * against `"12"` fails. `""` means "not provided", matching the RPCs' own
 * `nullif(payload->>'x','')`.
 */
const numberIn = (min: number, max: number, message: string) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number({ invalid_type_error: message }).min(min, message).max(max, message).optional(),
  );

const requiredNumberIn = (min: number, max: number, message: string) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number({ invalid_type_error: message, required_error: message }).min(min, message).max(max, message),
  );

/** `YYYY-MM-DD`. */
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");

const daysBetween = (from: string, to: string) =>
  Math.round(
    (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000,
  );

/** Case- and space-insensitive comparison, for the uniqueness checks. */
const norm = (v: string) => v.trim().toLowerCase();

/* ------------------------------------------------------- 2.2 StartUp (S-2.1) */

/**
 * Institution identity. This data prints on every certificate and marksheet
 * and is submitted to the education board, and it had no validation at all.
 *
 * EIIN is exactly six digits — the Ministry's own format, and a board
 * submission with anything else is rejected at the far end, weeks later. The
 * founding-year upper bound is `currentYear()` rather than a constant: a
 * school founded next year does not exist, and `99999` was accepted.
 */
export const startupSchema = z
  .object({
    name_bn: shortText(150).min(1, "Bangla name is required"),
    name_en: shortText(150).min(1, "English name is required"),
    eiin: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z.string().regex(/^\d{6}$/, "EIIN is exactly 6 digits").optional(),
    ),
    institution_code: optionalText(30),
    institution_type: optionalText(40),
    established_year: numberIn(1800, currentYear(), `Founding year must be between 1800 and ${currentYear()}`),
    board_id: optionalUuid,
    mpo_status: optionalText(20),
    address: optionalText(300),
    phone: optionalBdMobile,
    email: z.preprocess((v) => (v === "" ? undefined : v), z.string().email("Enter a valid email address").optional()),
    website: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z
        .string()
        .url("Enter a full address including https://")
        // A `mailto:` or `javascript:` URL passes `z.string().url()`. The field
        // is rendered as a link on the marksheet header, so restrict the scheme
        // rather than trusting the operator to type one.
        .refine((u) => /^https?:\/\//i.test(u), "The address must start with http:// or https://")
        .optional(),
    ),
    head_teacher_id: optionalUuid,
  })
  .strip();
export type StartupValues = z.infer<typeof startupSchema>;

/* -------------------------------------------------- 2.6 Subject (S-6.1, S-6.5) */

const MARKS_MESSAGE = "Marks must be between 0 and 1000";
const LEVEL_MESSAGE = "Class level must be between 1 and 12";

/**
 * `existingCodes` / `existingLevels` are passed in rather than fetched, because
 * a schema that reaches for data is no longer a pure parse and cannot be
 * tested without a client. The caller already holds the list it renders.
 */
export function subjectSchema(existingCodes: readonly string[] = []) {
  const taken = new Set(existingCodes.map(norm));
  return z
    .object({
      name_bn: shortText(120).min(1, "Bangla name is required"),
      name_en: shortText(120).min(1, "English name is required"),
      code: z.preprocess(
        (v) => (v === "" ? undefined : v),
        shortText(20)
          .refine((c) => !taken.has(norm(c)), "Another subject already uses this code")
          .optional(),
      ),
      type: shortText(20).min(1, "Pick a subject type"),
      full_marks: numberIn(0, 1000, MARKS_MESSAGE),
      pass_marks: numberIn(0, 1000, MARKS_MESSAGE),
      min_class_level: numberIn(1, 12, LEVEL_MESSAGE),
      max_class_level: numberIn(1, 12, LEVEL_MESSAGE),
      status: shortText(20),
    })
    .superRefine((v, ctx) => {
      // A subject nobody can pass. Reported on `pass_marks`, not on the form,
      // because that is the field the operator has to change.
      if (v.full_marks !== undefined && v.pass_marks !== undefined && v.pass_marks > v.full_marks) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["pass_marks"],
          message: "Pass marks cannot be higher than full marks",
        });
      }
      // A subject applicable to no class.
      if (
        v.min_class_level !== undefined &&
        v.max_class_level !== undefined &&
        v.min_class_level > v.max_class_level
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["max_class_level"],
          message: "The highest class cannot be below the lowest",
        });
      }
    });
}
export type SubjectValues = z.infer<ReturnType<typeof subjectSchema>>;

/* ------------------------------------------------ 2.3 Class Config (S-3.2, S-3.3) */

/**
 * `numeric_level` is what orders classes everywhere in the product. Two
 * classes at level 9 makes that ordering ambiguous in every report, and
 * nothing checked it.
 */
export function classSchema(existingLevels: readonly (number | null)[] = []) {
  const taken = new Set(existingLevels.filter((l): l is number => l !== null));
  return z.object({
    name_bn: shortText(80).min(1, "Bangla name is required"),
    name_en: shortText(80).min(1, "English name is required"),
    numeric_level: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
      z
        .number({ invalid_type_error: LEVEL_MESSAGE })
        .int("Class level must be a whole number")
        .min(1, LEVEL_MESSAGE)
        .max(12, LEVEL_MESSAGE)
        .refine((l) => !taken.has(l), "Another class is already at this level")
        .optional(),
    ),
  });
}
export type ClassValues = z.infer<ReturnType<typeof classSchema>>;

/**
 * Section capacity, against the students already enrolled in it.
 *
 * Capacity 20 on a section holding 45 was accepted, and the table then reported
 * permanent over-subscription with no explanation and no way to reach a valid
 * state except by unenrolling children.
 */
export function classSectionSchema(enrolled = 0) {
  return z.object({
    section_id: uuid,
    class_teacher_id: optionalUuid,
    capacity: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
      z
        .number({ invalid_type_error: "Capacity must be a number" })
        .int("Capacity must be a whole number")
        .min(1, "Capacity must be at least 1")
        .max(500, "Capacity must be 500 or fewer")
        .refine((c) => c >= enrolled, `${enrolled} students are already enrolled in this section`)
        .optional(),
    ),
  });
}
export type ClassSectionValues = z.infer<ReturnType<typeof classSectionSchema>>;

/* ------------------------------------------- 2.7 Subject Group (S-7.1, S-7.2, S-7.9) */

/**
 * A group with zero subjects saved successfully and then rendered "No
 * subjects" — a valid-looking record that does nothing, and a silent no-op in
 * elective assignment.
 *
 * `name_bn` is new. Every sibling entity in the schema carries `name_bn` and
 * `name_en`; the group carried one untagged `name`, so a Bangla-locale
 * operator read a Latin-script label in an otherwise Bangla list (S-7.9).
 */
export function subjectGroupSchema(existingNames: readonly string[] = []) {
  const taken = new Set(existingNames.map(norm));
  return z.object({
    name: shortText(80)
      .min(1, "Group name is required")
      .refine((v) => !taken.has(norm(v)), "Another group already has this name"),
    name_bn: optionalText(80),
    subject_ids: z.array(uuid).min(1, "Pick at least one subject"),
  });
}
export type SubjectGroupValues = z.infer<ReturnType<typeof subjectGroupSchema>>;

/* --------------------------------------------- 2.4 Academic Calendar (S-4.3, S-4.9) */

/** The longest range worth marking in one action. A year plus a leap day. */
export const MAX_RANGE_DAYS = 366;

/**
 * A holiday or working-day range.
 *
 * `to < from` was prevented by the `min` attribute on the input alone, so a
 * pasted or scripted value reached the RPC and marked nothing, reported as
 * success.
 */
export const calendarRangeSchema = z
  .object({
    from: day,
    to: day,
    label: optionalText(120),
    is_working_day: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const span = daysBetween(v.from, v.to);
    if (span < 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["to"], message: "The end date cannot be before the start date" });
      return;
    }
    if (span + 1 > MAX_RANGE_DAYS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["to"],
        message: `A range cannot be longer than ${MAX_RANGE_DAYS} days`,
      });
    }
  });
export type CalendarRangeValues = z.infer<typeof calendarRangeSchema>;

export type TermBounds = { id?: string; name: string; start_date: string; end_date: string };

/**
 * A term, against the academic year that contains it and the terms beside it.
 *
 * Neither check existed: a term could start before the academic year, end
 * after it, or sit exactly on top of another one — and marksheets and fee
 * schedules are generated per term, so overlapping terms produce two answers
 * to "which term is this mark in".
 *
 * `year` may be undefined while the provider loads; the containment rule is
 * then skipped rather than failing, because "we do not know yet" is not the
 * same as "it is outside".
 */
export function termSchema(
  siblings: readonly TermBounds[] = [],
  year?: { start_date: string; end_date: string },
  editingId?: string,
) {
  return z
    .object({
      name: shortText(80).min(1, "Term name is required"),
      start_date: day,
      end_date: day,
      is_current: z.boolean(),
    })
    .superRefine((v, ctx) => {
      if (daysBetween(v.start_date, v.end_date) < 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["end_date"], message: "The end date cannot be before the start date" });
        return;
      }
      if (year) {
        if (v.start_date < year.start_date) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["start_date"], message: "The term starts before the academic year does" });
        }
        if (v.end_date > year.end_date) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["end_date"], message: "The term ends after the academic year does" });
        }
      }
      const clash = siblings.find(
        (s) => s.id !== editingId && v.start_date <= s.end_date && s.start_date <= v.end_date,
      );
      if (clash) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["start_date"],
          message: `These dates overlap ${clash.name}`,
        });
      }
    });
}
export type TermValues = z.infer<ReturnType<typeof termSchema>>;

/* ------------------------------------------------- 2.8 Grading Scheme (S-8.7) */

/**
 * GPA bounds, alongside — never instead of — `validateGradeScale`.
 *
 * `gradeScale.ts` already checks the thing that matters most (no gap and no
 * overlap in the marks bands, because either silently mis-grades a cohort) and
 * is the module's best example of validation done well. What it does not check
 * is the GPA column: negative points and points above the scheme maximum were
 * both accepted, and a 5.00 scheme with a 9.00 band produces a GPA no
 * transcript can explain.
 */
export const MAX_GPA = 5;

export function gradeSchemeSchema(existingNames: readonly string[] = []) {
  const taken = new Set(existingNames.map(norm));
  return z.object({
    name: shortText(80)
      .min(1, "Scheme name is required")
      .refine((v) => !taken.has(norm(v)), "Another scheme already has this name"),
    is_default: z.boolean(),
    scales: z
      .array(
        z.object({
          grade_letter: shortText(5).min(1, "Grade letter is required"),
          gpa_point: requiredNumberIn(0, MAX_GPA, `GPA must be between 0 and ${MAX_GPA}`),
          min_marks: requiredNumberIn(0, 100, MARKS_MESSAGE),
          max_marks: requiredNumberIn(0, 100, MARKS_MESSAGE),
        }),
      )
      .min(1, "A scheme needs at least one grade band"),
  });
}
export type GradeSchemeValues = z.infer<ReturnType<typeof gradeSchemeSchema>>;

/* ---------------------------------------------------- 2.1 Basic Config (S-1.10) */

/** Which weekdays each working-days option actually covers. 0 = Sunday. */
const WORKING_DAY_SET: Record<string, number[]> = {
  sun_thu: [0, 1, 2, 3, 4],
  sat_thu: [6, 0, 1, 2, 3, 4],
  mon_fri: [1, 2, 3, 4, 5],
};
/** Which weekdays each weekend option covers. */
const WEEKEND_SET: Record<string, number[]> = {
  fri_sat: [5, 6],
  sat_sun: [6, 0],
  fri_only: [5],
};

/**
 * The one thing `NUMERIC_RULES` could never catch (S-1.10).
 *
 * `working_days` and `weekend` are two independent selects over the same seven
 * days, and nothing checked that they agree. A Sun–Thu working week with a
 * Sat–Sun weekend claims Sunday is both, and the two are read by different
 * consumers — attendance takes the working week, the calendar paints the
 * weekend — so the contradiction shows up as attendance recorded on a day the
 * calendar greys out.
 *
 * Returns the overlapping day names, or an empty array. Not a zod schema: the
 * screen holds an open jsonb document rather than a fixed object, and this is
 * the one rule in it that spans two keys.
 */
export function weekendConflict(workingDays: unknown, weekend: unknown): number[] {
  const work = WORKING_DAY_SET[String(workingDays ?? "")];
  const off = WEEKEND_SET[String(weekend ?? "")];
  if (!work || !off) return [];
  return work.filter((d) => off.includes(d));
}

/* ----------------------------------------------------------- 2.5 Signature */

/** A signature block prints a name under a line. An empty one prints a line. */
export const signatureSchema = z.object({
  role_label: shortText(60).min(1, "Role is required"),
  holder_name: shortText(120).min(1, "Enter the name that should appear under the signature"),
});
export type SignatureValues = z.infer<typeof signatureSchema>;
