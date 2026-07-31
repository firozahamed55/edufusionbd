// Supabase data access for admin/student/registration.
// Atomic create via the fn_register_student RPC (single transaction, no orphans).
import { z } from "zod";
import type { BrowserClient } from "@/shared/services/supabase/types";
import {
  optionalBdBirthRegNo,
  optionalBdMobile,
  optionalBdNid,
  optionalText,
  optionalUuid,
  shortText,
  studentDob,
  isoDate,
} from "@/shared/lib/validation";

/**
 * Admission, validated per field (SRA A-0.2, A-2.1).
 *
 * This is the largest form in the product — 31 inputs across four cards, one of
 * them two scroll-lengths from the Save button. It used to gate on a boolean
 * (`f.name_bn && f.name_en && f.dob && …`) and, on failure, fire a 4-second
 * toast that named no field. Birth registration number, NID and mobile were
 * free text with a placeholder hint, so a malformed guardian mobile — the one
 * field every SMS the school ever sends depends on — was accepted silently.
 *
 * Every message here is written to be read by an office assistant under time
 * pressure, not by a developer.
 */
export const registerStudentSchema = z
  .object({
    name_bn: shortText(120).min(1, "বাংলা নাম আবশ্যক / Bangla name is required"),
    name_en: shortText(120).min(1, "English name is required"),
    dob: studentDob,
    gender: z.string().min(1, "Select a gender"),
    blood_group: optionalText(10),
    religion: optionalText(30),
    birth_reg_no: optionalBdBirthRegNo,
    nationality: optionalText(60),
    academic_year_id: optionalUuid.refine((v) => Boolean(v), "Select the academic year"),
    class_section_id: optionalUuid.refine((v) => Boolean(v), "Select a class & section"),
    roll_no: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z.string().regex(/^\d{1,5}$/, "Roll must be a number").optional(),
    ),
    admission_date: z.preprocess((v) => (v === "" ? undefined : v), isoDate.optional()),
    student_category_id: optionalUuid,
    father_name: optionalText(120),
    father_occupation: optionalText(80),
    guardian_name: optionalText(120),
    relationship: optionalText(40),
    // The one optional-looking field that is not optional in practice: it is
    // how every SMS, fee reminder and absence notice reaches the family.
    guardian_mobile: optionalBdMobile.refine((v) => Boolean(v), "Guardian mobile is required"),
    guardian_nid: optionalBdNid,
    monthly_income: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z.string().regex(/^\d+$/, "Income must be a number").optional(),
    ),
    present_division_id: optionalUuid,
    present_district_id: optionalUuid,
    present_upazila_id: optionalUuid,
    present_village: optionalText(120),
    present_house_road: optionalText(120),
    permanent_division_id: optionalUuid,
    permanent_district_id: optionalUuid,
    permanent_upazila_id: optionalUuid,
    permanent_village: optionalText(120),
    permanent_house_road: optionalText(120),
  })
  .strict();

/**
 * What the FORM holds: every field is the string an `<input>`/`<select>` gives
 * back. Written out rather than derived with `z.input<>` because a
 * `z.preprocess` field types its input as `unknown`, which is exactly the
 * string this schema exists to normalise.
 */
export type RegisterFormValues = { [K in keyof Required<RegisterPayload>]: string };

export type RegisterPayload = {
  name_bn: string;
  name_en: string;
  dob: string;
  gender: string;
  blood_group?: string;
  religion?: string;
  birth_reg_no?: string;
  nationality?: string;
  academic_year_id?: string;
  class_section_id?: string;
  roll_no?: string;
  admission_date?: string;
  student_category_id?: string;
  father_name?: string;
  father_occupation?: string;
  guardian_name?: string;
  relationship?: string;
  guardian_mobile?: string;
  guardian_nid?: string;
  monthly_income?: string;
  present_division_id?: string;
  present_district_id?: string;
  present_upazila_id?: string;
  present_village?: string;
  present_house_road?: string;
  permanent_division_id?: string;
  permanent_district_id?: string;
  permanent_upazila_id?: string;
  permanent_village?: string;
  permanent_house_road?: string;
};

/** UI blood-group label ("A+") → DB enum token ("a_pos"). Single source in shared enums. */
export { BLOOD_TOKEN } from "@/shared/constants/enums";

export async function registerStudent(
  supabase: BrowserClient,
  payload: RegisterPayload,
): Promise<string> {
  const { data, error } = await supabase.rpc("fn_register_student", { payload });
  if (error) throw new Error(error.message);
  return data ?? "";
}
