// Supabase data access for the Teacher module (registration + update-profile),
// shared by the TeacherForm component. RLS-scoped to the caller's institution;
// writes go through transaction-safe RPCs (fn_register_teacher / fn_update_teacher).
import type { BrowserClient } from "@/shared/services/supabase/types";
import { BLOOD_LABEL } from "@/shared/constants/enums";

/** Full controlled-form shape. Enum fields hold DB values, except `blood_group`
 *  which holds the UI label ("A+"); it is mapped to the DB token on write. */
export type TeacherFormValues = {
  id: string;
  employee_code: string;
  name_bn: string;
  name_en: string;
  dob: string;
  gender: string;
  blood_group: string;
  religion: string;
  nid: string;
  nationality: string;
  designation_id: string;
  department_id: string;
  main_subject_id: string;
  joining_date: string;
  employment_type: string;
  email: string;
  mobile: string;
  alt_mobile: string;
  emergency_contact_name: string;
  emergency_contact_relation: string;
  emergency_contact_number: string;
  highest_degree: string;
  experience_years: string;
  present_division_id: string;
  present_district_id: string;
  present_upazila_id: string;
  present_village: string;
  present_house_road: string;
  permanent_division_id: string;
  permanent_district_id: string;
  permanent_upazila_id: string;
  permanent_village: string;
  permanent_house_road: string;
};

/** Payload sent to the write RPCs (blood_group already mapped to the DB token). */
export type TeacherWritePayload = Omit<TeacherFormValues, "id" | "employee_code">;

type RpcFn = (
  fn: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>;

/** Atomic teacher registration (teacher + present/permanent addresses). */
export async function registerTeacher(
  supabase: BrowserClient,
  payload: TeacherWritePayload,
): Promise<string> {
  const rpc: RpcFn = (fn, args) => (supabase as unknown as { rpc: RpcFn }).rpc(fn, args);
  const { data, error } = await rpc("fn_register_teacher", { payload });
  if (error) throw new Error(error.message);
  return (data as string) ?? "";
}

/** Atomic teacher update (institution-guarded server-side). */
export async function updateTeacher(
  supabase: BrowserClient,
  payload: TeacherWritePayload & { id: string },
): Promise<string> {
  const rpc: RpcFn = (fn, args) => (supabase as unknown as { rpc: RpcFn }).rpc(fn, args);
  const { data, error } = await rpc("fn_update_teacher", { payload });
  if (error) throw new Error(error.message);
  return (data as string) ?? "";
}

export type TeacherOption = { value: string; label: string };

/** Selectable list of existing teachers (for the update-profile picker). */
export async function fetchTeacherOptions(
  supabase: BrowserClient,
): Promise<TeacherOption[]> {
  const { data, error } = await supabase
    .from("teacher")
    .select("id, employee_code, name_bn, name_en")
    .is("deleted_at", null)
    .order("employee_code", { ascending: true });
  if (error) throw error;
  const list = (data ?? []) as unknown as {
    id: string;
    employee_code: string | null;
    name_en: string;
  }[];
  return list.map((r) => ({ value: r.id, label: `${r.employee_code ?? "—"} · ${r.name_en}` }));
}

const s = (v: unknown): string => (v == null ? "" : String(v));

/** One teacher hydrated into the controlled-form shape (addresses split by type). */
export async function fetchTeacherDetail(
  supabase: BrowserClient,
  id: string,
): Promise<TeacherFormValues> {
  const { data, error } = await supabase
    .from("teacher")
    .select(
      "id, employee_code, name_bn, name_en, dob, gender, blood_group, religion, nid, nationality, designation_id, department_id, main_subject_id, joining_date, employment_type, email, mobile, alt_mobile, emergency_contact_name, emergency_contact_relation, emergency_contact_number, highest_degree, experience_years, teacher_address(type, division_id, district_id, upazila_id, village, house_road)",
    )
    .eq("id", id)
    .single();
  if (error) throw error;

  const t = data as unknown as Record<string, unknown>;
  const addr = (t.teacher_address ?? []) as Array<Record<string, unknown>>;
  const present = addr.find((a) => a.type === "present");
  const permanent = addr.find((a) => a.type === "permanent");
  const bloodToken = s(t.blood_group);

  return {
    id: s(t.id),
    employee_code: s(t.employee_code),
    name_bn: s(t.name_bn),
    name_en: s(t.name_en),
    dob: s(t.dob),
    gender: s(t.gender),
    blood_group: bloodToken ? BLOOD_LABEL[bloodToken] ?? "" : "",
    religion: s(t.religion),
    nid: s(t.nid),
    nationality: s(t.nationality) || "বাংলাদেশি",
    designation_id: s(t.designation_id),
    department_id: s(t.department_id),
    main_subject_id: s(t.main_subject_id),
    joining_date: s(t.joining_date),
    employment_type: s(t.employment_type),
    email: s(t.email),
    mobile: s(t.mobile),
    alt_mobile: s(t.alt_mobile),
    emergency_contact_name: s(t.emergency_contact_name),
    emergency_contact_relation: s(t.emergency_contact_relation),
    emergency_contact_number: s(t.emergency_contact_number),
    highest_degree: s(t.highest_degree),
    experience_years: s(t.experience_years),
    present_division_id: s(present?.division_id),
    present_district_id: s(present?.district_id),
    present_upazila_id: s(present?.upazila_id),
    present_village: s(present?.village),
    present_house_road: s(present?.house_road),
    permanent_division_id: s(permanent?.division_id),
    permanent_district_id: s(permanent?.district_id),
    permanent_upazila_id: s(permanent?.upazila_id),
    permanent_village: s(permanent?.village),
    permanent_house_road: s(permanent?.house_road),
  };
}
