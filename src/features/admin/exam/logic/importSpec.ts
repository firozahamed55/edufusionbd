import { z } from "zod";
import { createClient } from "@/shared/services/supabase/client";
import type { ImportOutcome, ImportSpec } from "@/shared/import/types";

/**
 * Marks importer (SRA A-5.1 item 5 — "teachers keep marks in Excel; there is
 * no CSV path in or out").
 *
 * Keyed by ROLL NUMBER, not student id: a teacher's sheet has a roll column
 * and nothing else that identifies a person. Resolution happens server-side
 * against the chosen section, so an unmatched roll is a named rejection rather
 * than a silent skip.
 *
 * Full marks are NOT a column. The exam's own `mark_config` decides them
 * (A-5.1 item 1); a sheet that says 100 for a subject configured at 50 is
 * exactly how a section's GPA goes wrong with nothing to catch it.
 */

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const toAscii = (v: string) => v.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));

/** "A", "absent", "অনুপস্থিত", "-" all mean the same thing on a mark sheet. */
const ABSENT = /^(a|ab|abs|absent|অনু|অনুপস্থিত|-|–|—|n\/a)$/i;

export const markImportSchema = z
  .object({
    roll_no: z.string().trim().regex(/^\d{1,5}$/, "must be a roll number"),
    marks_obtained: z.string().trim().optional().default(""),
    is_absent: z.boolean(),
  })
  .strict()
  .refine((r) => r.is_absent || r.marks_obtained !== "", {
    message: "enter a mark, or write 'A' for absent",
    path: ["marks_obtained"],
  });

export type MarkImportRow = z.infer<typeof markImportSchema>;

export function markImportSpec(context: {
  exam_id: string;
  class_section_id: string;
  subject_id: string;
}): ImportSpec<MarkImportRow> {
  return {
    key: "marks",
    title: { bn: "নম্বর আমদানি", en: "Import marks" },
    description: {
      bn: "উপরে নির্বাচিত পরীক্ষা, শাখা ও বিষয়ের জন্য CSV থেকে নম্বর তুলুন। পূর্ণমান পরীক্ষার কনফিগ থেকে নেওয়া হয় — ফাইল থেকে নয়।",
      en: "Load marks from a CSV for the exam, section and subject selected above. Full marks come from the exam configuration, not from the file.",
    },
    fields: [
      { key: "roll_no", bn: "রোল", en: "Roll no.", required: true, aliases: ["roll", "roll number", "রোল"], example: "1", transform: toAscii },
      {
        key: "marks_obtained",
        bn: "প্রাপ্ত নম্বর",
        en: "Marks obtained",
        required: true,
        aliases: ["marks", "mark", "obtained", "score", "নম্বর"],
        example: "78",
        // An absent marker lands here in a real sheet; the boolean below reads
        // the same cell. Blanking it keeps "absent" out of the numeric field.
        transform: (v) => (ABSENT.test(v.trim()) ? "" : toAscii(v).trim()),
      },
      {
        key: "is_absent",
        bn: "অনুপস্থিত",
        en: "Absent",
        aliases: ["absent", "status", "অনুপস্থিত"],
        example: "A",
        transform: (v) => (ABSENT.test(v.trim()) || /^(1|true|yes|y)$/i.test(v.trim()) ? "true" : "false"),
      },
    ],
    schema: z.preprocess(
      // `is_absent` is a checkbox in the manual grid and a text cell here.
      // Coercing at the boundary keeps the schema honest about its own type
      // instead of accepting `"false"` as truthy.
      (raw) => {
        const r = raw as Record<string, string>;
        const marker = r.is_absent ?? "";
        const marks = r.marks_obtained ?? "";
        return { ...r, is_absent: marker === "true" || (marks === "" && ABSENT.test(marker)) };
      },
      markImportSchema,
    ) as unknown as z.ZodType<MarkImportRow, z.ZodTypeDef, unknown>,
    batchSize: 200,
    commit: async (rows) => {
      const { data, error } = await createClient().rpc("fn_import_marks", {
        payload: { ...context, rows },
      });
      if (error) throw new Error(error.message);
      return data as unknown as ImportOutcome;
    },
  };
}
