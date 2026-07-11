// Shared reference-data lookups (RLS-scoped where tenant, global for geo).
import type { BrowserClient } from "@/shared/services/supabase/types";

export type Option = { value: string; label_bn: string; label_en: string };

const rows = <T>(data: unknown): T[] => (data ?? []) as unknown as T[];

export async function fetchDivisions(supabase: BrowserClient): Promise<Option[]> {
  const { data, error } = await supabase.from("division").select("id, name_bn, name_en").order("name_en");
  if (error) throw error;
  return rows<{ id: string; name_bn: string; name_en: string }>(data).map((d) => ({
    value: d.id,
    label_bn: d.name_bn,
    label_en: d.name_en,
  }));
}

export async function fetchDistricts(supabase: BrowserClient, divisionId: string): Promise<Option[]> {
  const { data, error } = await supabase
    .from("district")
    .select("id, name_bn, name_en")
    .eq("division_id", divisionId)
    .order("name_en");
  if (error) throw error;
  return rows<{ id: string; name_bn: string; name_en: string }>(data).map((d) => ({
    value: d.id,
    label_bn: d.name_bn,
    label_en: d.name_en,
  }));
}

export async function fetchUpazilas(supabase: BrowserClient, districtId: string): Promise<Option[]> {
  const { data, error } = await supabase
    .from("upazila")
    .select("id, name_bn, name_en")
    .eq("district_id", districtId)
    .order("name_en");
  if (error) throw error;
  return rows<{ id: string; name_bn: string; name_en: string }>(data).map((d) => ({
    value: d.id,
    label_bn: d.name_bn,
    label_en: d.name_en,
  }));
}

export async function fetchAcademicYears(supabase: BrowserClient): Promise<Option[]> {
  const { data, error } = await supabase
    .from("academic_year")
    .select("id, year_label, is_current")
    .is("deleted_at", null)
    .order("year_label", { ascending: false });
  if (error) throw error;
  return rows<{ id: string; year_label: string }>(data).map((d) => ({
    value: d.id,
    label_bn: d.year_label,
    label_en: d.year_label,
  }));
}

export async function fetchClassSections(supabase: BrowserClient): Promise<Option[]> {
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
  const opts = rows<Raw>(data).map((r) => ({
    value: r.id,
    label_bn: `${r.class?.name_bn ?? ""} — ${r.section?.name ?? ""}`,
    label_en: `${r.class?.name_en ?? ""} — ${r.section?.name ?? ""}`,
    level: r.class?.numeric_level ?? 0,
  }));
  opts.sort((a, b) => a.level - b.level);
  return opts.map((o) => ({ value: o.value, label_bn: o.label_bn, label_en: o.label_en }));
}

export async function fetchStudentCategories(supabase: BrowserClient): Promise<Option[]> {
  const { data, error } = await supabase
    .from("student_category")
    .select("id, name")
    .is("deleted_at", null)
    .order("name");
  if (error) throw error;
  return rows<{ id: string; name: string }>(data).map((d) => ({
    value: d.id,
    label_bn: d.name,
    label_en: d.name,
  }));
}

export async function fetchClasses(supabase: BrowserClient): Promise<Option[]> {
  const { data, error } = await supabase
    .from("class")
    .select("id, name_bn, name_en, numeric_level")
    .is("deleted_at", null)
    .order("numeric_level", { ascending: true });
  if (error) throw error;
  return rows<{ id: string; name_bn: string; name_en: string }>(data).map((d) => ({
    value: d.id,
    label_bn: d.name_bn,
    label_en: d.name_en,
  }));
}

export async function fetchDesignations(supabase: BrowserClient): Promise<Option[]> {
  const { data, error } = await supabase
    .from("designation")
    .select("id, name, rank")
    .is("deleted_at", null)
    .order("rank", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return rows<{ id: string; name: string }>(data).map((d) => ({
    value: d.id,
    label_bn: d.name,
    label_en: d.name,
  }));
}

export async function fetchDepartments(supabase: BrowserClient): Promise<Option[]> {
  const { data, error } = await supabase
    .from("department")
    .select("id, name")
    .is("deleted_at", null)
    .order("name");
  if (error) throw error;
  return rows<{ id: string; name: string }>(data).map((d) => ({
    value: d.id,
    label_bn: d.name,
    label_en: d.name,
  }));
}

export async function fetchSubjects(supabase: BrowserClient): Promise<Option[]> {
  const { data, error } = await supabase
    .from("subject")
    .select("id, name_bn, name_en")
    .is("deleted_at", null)
    .order("name_en");
  if (error) throw error;
  return rows<{ id: string; name_bn: string; name_en: string }>(data).map((d) => ({
    value: d.id,
    label_bn: d.name_bn,
    label_en: d.name_en,
  }));
}
