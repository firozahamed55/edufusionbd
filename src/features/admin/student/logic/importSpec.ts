import { z } from "zod";
import { createClient } from "@/shared/services/supabase/client";
import type { ImportOutcome, ImportSpec } from "@/shared/import/types";
import { BLOOD_TOKEN } from "@/shared/constants/enums";

/**
 * Student importer (SRA A-0.5 point 1).
 *
 * The schema is deliberately NOT `registerStudentSchema` verbatim: the manual
 * form supplies `academic_year_id` and `class_section_id` from selects the
 * operator has already chosen, and a sheet cannot. Those two come from the
 * screen and are merged in, so a CSV carries only what a school actually has
 * in a spreadsheet.
 */

/** Bengali numerals in a sheet are ordinary — the product renders them. */
const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const toAscii = (v: string) => v.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));

/**
 * Dates. Excel writes whatever the machine's locale says, and a Bangladeshi
 * office machine writes `dd/mm/yyyy`. Passing that to a `date` column casts to
 * the wrong day for the first twelve of every month and errors for the rest —
 * a birth date that is silently wrong is worse than one that is rejected.
 */
function toIsoDate(raw: string): string {
  const v = toAscii(raw).trim();
  if (!v) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(v);
  if (!m) return v; // let zod reject it with a message naming the field
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

const required = (bn: string, en: string) => z.string().trim().min(1, `${en} is required`);
const optional = z.string().trim().optional().default("");

export const studentImportSchema = z
  .object({
    name_bn: required("বাংলা নাম আবশ্যক", "Name (Bangla)"),
    name_en: required("English name", "Name (English)"),
    dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be a date, e.g. 2014-03-21"),
    gender: z.enum(["male", "female", "other"], { message: "must be male, female or other" }),
    roll_no: optional,
    guardian_name: optional,
    guardian_mobile: z
      .string()
      .trim()
      .regex(/^01[3-9]\d{8}$/, "must be a Bangladeshi mobile, e.g. 01712345678"),
    father_name: optional,
    blood_group: optional,
    religion: optional,
    birth_reg_no: optional,
    admission_date: optional,
    present_village: optional,
  })
  .strict();

export type StudentImportRow = z.infer<typeof studentImportSchema>;

export function studentImportSpec(context: {
  academic_year_id: string;
  class_section_id: string;
}): ImportSpec<StudentImportRow> {
  return {
    key: "students",
    title: { bn: "শিক্ষার্থী আমদানি", en: "Import students" },
    description: {
      bn: "একটি CSV ফাইল থেকে একসাথে অনেক শিক্ষার্থী ভর্তি করুন। নির্বাচিত শিক্ষাবর্ষ ও শাখাতেই সবাই যুক্ত হবে।",
      en: "Admit many students at once from a CSV. Everyone is enrolled into the year and section selected above.",
    },
    fields: [
      { key: "name_bn", bn: "নাম (বাংলা)", en: "Name (Bangla)", required: true, aliases: ["নাম", "name bangla", "bangla name"], example: "রাহিম উদ্দিন" },
      { key: "name_en", bn: "নাম (English)", en: "Name (English)", required: true, aliases: ["name", "student name", "full name"], example: "Rahim Uddin" },
      { key: "dob", bn: "জন্ম তারিখ", en: "Date of birth", required: true, aliases: ["dob", "birth date", "জন্ম তারিখ"], example: "2014-03-21", transform: toIsoDate },
      { key: "gender", bn: "লিঙ্গ", en: "Gender", required: true, aliases: ["sex", "লিঙ্গ"], example: "male", transform: (v) => v.trim().toLowerCase() },
      { key: "guardian_mobile", bn: "অভিভাবকের মোবাইল", en: "Guardian mobile", required: true, aliases: ["mobile", "phone", "contact", "মোবাইল"], example: "01712345678", transform: (v) => toAscii(v).replace(/[^\d]/g, "").replace(/^88/, "") },
      { key: "roll_no", bn: "রোল", en: "Roll no.", aliases: ["roll", "রোল"], example: "1", transform: toAscii },
      { key: "guardian_name", bn: "অভিভাবকের নাম", en: "Guardian name", aliases: ["guardian", "অভিভাবক"], example: "Karim Uddin" },
      { key: "father_name", bn: "পিতার নাম", en: "Father's name", aliases: ["father", "পিতা"], example: "Karim Uddin" },
      { key: "blood_group", bn: "রক্তের গ্রুপ", en: "Blood group", aliases: ["blood", "রক্ত"], example: "B+", transform: (v) => BLOOD_TOKEN[v.trim().toUpperCase()] ?? "" },
      { key: "religion", bn: "ধর্ম", en: "Religion", aliases: ["ধর্ম"], example: "islam", transform: (v) => v.trim().toLowerCase() },
      { key: "birth_reg_no", bn: "জন্ম নিবন্ধন", en: "Birth reg. no.", aliases: ["birth registration", "brn"], example: "19981234567890123", transform: toAscii },
      { key: "admission_date", bn: "ভর্তির তারিখ", en: "Admission date", aliases: ["admission", "ভর্তি"], example: "2026-01-05", transform: toIsoDate },
      { key: "present_village", bn: "গ্রাম/মহল্লা", en: "Village / area", aliases: ["village", "area", "address", "গ্রাম"], example: "Rampur" },
    ],
    schema: studentImportSchema,
    batchSize: 100,
    commit: async (rows) => {
      const { data, error } = await createClient().rpc("fn_import_students", {
        payload: { rows: rows.map((r) => ({ ...r, ...context, nationality: "বাংলাদেশি" })) },
      });
      if (error) throw new Error(error.message);
      return data as unknown as ImportOutcome;
    },
  };
}
