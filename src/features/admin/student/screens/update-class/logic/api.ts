// Supabase data access for admin/student/update-class (Class List). RLS-scoped.
import type { BrowserClient } from "@/shared/services/supabase/types";

export type ClassSectionOption = { value: string; label_bn: string; label_en: string };

export async function fetchClassSections(
  supabase: BrowserClient,
): Promise<ClassSectionOption[]> {
  const { data, error } = await supabase
    .from("class_section")
    .select("id, class:class_id(name_bn, name_en, numeric_level), section:section_id(name)")
    .is("deleted_at", null);
  if (error) throw error;

  type Raw = {
    id: string;
    class: { name_bn: string; name_en: string; numeric_level: number | null } | null;
    section: { name: string } | null;
  };
  const rows = (data ?? []) as unknown as Raw[];
  const opts = rows.map((r) => ({
    value: r.id,
    label_bn: `${r.class?.name_bn ?? ""} — ${r.section?.name ?? ""}`,
    label_en: `${r.class?.name_en ?? ""} — ${r.section?.name ?? ""}`,
    level: r.class?.numeric_level ?? 0,
  }));
  opts.sort((a, b) => a.level - b.level);
  return opts.map((o) => ({ value: o.value, label_bn: o.label_bn, label_en: o.label_en }));
}

export type StudentClassRow = {
  enrollmentId: string;
  studentId: string;
  code: string | null;
  roll: number | null;
  name_bn: string;
  name_en: string;
  father: string | null;
  dob: string;
  phone: string | null;
};

export async function fetchStudentsBySection(
  supabase: BrowserClient,
  classSectionId: string,
): Promise<StudentClassRow[]> {
  const { data, error } = await supabase
    .from("student_enrollment")
    .select(
      "id, roll_no, student:student_id(id, student_code, name_bn, name_en, dob, student_guardian(relationship, is_primary_contact, guardian:guardian_id(name, mobile)))",
    )
    .eq("class_section_id", classSectionId)
    .eq("status", "active")
    .order("roll_no", { ascending: true });
  if (error) throw error;

  type Guardian = { name: string | null; mobile: string | null };
  type SG = { relationship: string; is_primary_contact: boolean; guardian: Guardian | null };
  type Raw = {
    id: string;
    roll_no: number | null;
    student: {
      id: string;
      student_code: string | null;
      name_bn: string;
      name_en: string;
      dob: string;
      student_guardian: SG[] | null;
    } | null;
  };
  const rows = (data ?? []) as unknown as Raw[];

  return rows.map((r) => {
    const sgs = r.student?.student_guardian ?? [];
    const primary =
      sgs.find((g) => g.is_primary_contact) ??
      sgs.find((g) => g.relationship === "father") ??
      sgs[0];
    return {
      enrollmentId: r.id,
      studentId: r.student?.id ?? "",
      code: r.student?.student_code ?? null,
      roll: r.roll_no,
      name_bn: r.student?.name_bn ?? "",
      name_en: r.student?.name_en ?? "",
      father: primary?.guardian?.name ?? null,
      dob: r.student?.dob ?? "",
      phone: primary?.guardian?.mobile ?? null,
    };
  });
}
