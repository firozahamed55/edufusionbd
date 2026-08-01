import { z } from "zod";
import { createClient } from "@/shared/services/supabase/client";
import type { ImportOutcome, ImportSpec } from "@/shared/import/types";
import { BLOOD_TOKEN } from "@/shared/constants/enums";

/**
 * Teacher importer (SRA A-0.5 point 1).
 *
 * `teacherFormSchema` requires designation, department and main subject as
 * uuids the manual form gets from three selects. A staff spreadsheet has none
 * of those, so the importer takes them once from the screen and applies them
 * to the batch — which is also how a school actually onboards: one department
 * at a time.
 */

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const toAscii = (v: string) => v.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));

function toIsoDate(raw: string): string {
  const v = toAscii(raw).trim();
  if (!v) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(v);
  if (!m) return v;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

const optional = z.string().trim().optional().default("");

export const teacherImportSchema = z
  .object({
    name_bn: z.string().trim().min(1, "Name (Bangla) is required"),
    name_en: z.string().trim().min(1, "Name (English) is required"),
    mobile: z.string().trim().regex(/^01[3-9]\d{8}$/, "must be a Bangladeshi mobile, e.g. 01712345678"),
    email: z.string().trim().email("must be a valid email address"),
    gender: z.enum(["male", "female", "other"], { message: "must be male, female or other" }),
    dob: optional,
    joining_date: optional,
    nid: optional,
    blood_group: optional,
    highest_degree: optional,
    employment_type: optional,
  })
  .strict();

export type TeacherImportRow = z.infer<typeof teacherImportSchema>;

export function teacherImportSpec(context: {
  designation_id: string;
  department_id: string;
  main_subject_id: string;
}): ImportSpec<TeacherImportRow> {
  return {
    key: "teachers",
    title: { bn: "শিক্ষক আমদানি", en: "Import teachers" },
    description: {
      bn: "একটি CSV ফাইল থেকে একসাথে অনেক শিক্ষক যুক্ত করুন। নির্বাচিত পদবি, বিভাগ ও প্রধান বিষয় সবার ক্ষেত্রে প্রযোজ্য হবে।",
      en: "Add many teachers at once from a CSV. The designation, department and main subject selected above apply to everyone in the file.",
    },
    fields: [
      { key: "name_bn", bn: "নাম (বাংলা)", en: "Name (Bangla)", required: true, aliases: ["নাম", "bangla name"], example: "মোঃ করিম" },
      { key: "name_en", bn: "নাম (English)", en: "Name (English)", required: true, aliases: ["name", "teacher name", "full name"], example: "Md Karim" },
      { key: "mobile", bn: "মোবাইল", en: "Mobile", required: true, aliases: ["phone", "contact", "মোবাইল"], example: "01712345678", transform: (v) => toAscii(v).replace(/[^\d]/g, "").replace(/^88/, "") },
      { key: "email", bn: "ইমেইল", en: "Email", required: true, aliases: ["mail", "e-mail"], example: "karim@school.edu.bd", transform: (v) => v.trim().toLowerCase() },
      { key: "gender", bn: "লিঙ্গ", en: "Gender", required: true, aliases: ["sex", "লিঙ্গ"], example: "male", transform: (v) => v.trim().toLowerCase() },
      { key: "dob", bn: "জন্ম তারিখ", en: "Date of birth", aliases: ["dob", "birth date"], example: "1988-06-14", transform: toIsoDate },
      { key: "joining_date", bn: "যোগদানের তারিখ", en: "Joining date", aliases: ["joining", "join date"], example: "2019-01-02", transform: toIsoDate },
      { key: "nid", bn: "জাতীয় পরিচয়পত্র", en: "NID", aliases: ["nid no", "national id"], example: "1234567890", transform: toAscii },
      { key: "blood_group", bn: "রক্তের গ্রুপ", en: "Blood group", aliases: ["blood"], example: "O+", transform: (v) => BLOOD_TOKEN[v.trim().toUpperCase()] ?? "" },
      { key: "highest_degree", bn: "সর্বোচ্চ ডিগ্রি", en: "Highest degree", aliases: ["degree", "qualification"], example: "M.Sc" },
      { key: "employment_type", bn: "চাকরির ধরন", en: "Employment type", aliases: ["type", "employment"], example: "permanent", transform: (v) => v.trim().toLowerCase() },
    ],
    schema: teacherImportSchema,
    batchSize: 100,
    commit: async (rows) => {
      const { data, error } = await createClient().rpc("fn_import_teachers", {
        payload: { rows: rows.map((r) => ({ ...r, ...context, nationality: "বাংলাদেশি" })) },
      });
      if (error) throw new Error(error.message);
      return data as unknown as ImportOutcome;
    },
  };
}
