// Supabase data access for admin/student/registration.
// Atomic create via the fn_register_student RPC (single transaction, no orphans).
import type { BrowserClient } from "@/shared/services/supabase/types";

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
