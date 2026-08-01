/**
 * Full certificate record for printing — the record plus everything the sheet
 * names about the student that the certificate row itself does not carry.
 */
import type { BrowserClient } from "@/shared/services/supabase/types";

export type CertificateRecord = {
  id: string;
  created_at: string;
  cert_no: string | null;
  session: string | null;
  issued_at: string | null;
  parent_name: string | null;
  permanent_address: string | null;
  conduct: string | null;
  remarks: string | null;
  reason: string | null;
  cert_type: string | null;
  language: string | null;
  name_bn: string;
  name_en: string;
  student_code: string | null;
  dob: string | null;
  roll: number | null;
  class_name: string | null;
};

const STUDENT =
  "student:student_id(name_bn, name_en, student_code, dob, enr:current_enrollment_id(roll_no, cs:class_section_id(class:class_id(name_bn, name_en), section:section_id(name))))";

type Raw = {
  id: string; created_at: string; cert_no: string | null; session: string | null;
  issued_at?: string | null; issue_date?: string | null;
  parent_name: string | null; permanent_address: string | null; language: string | null;
  conduct?: string | null; remarks?: string | null; reason?: string | null; cert_type?: string | null;
  student: {
    name_bn: string; name_en: string; student_code: string | null; dob: string | null;
    enr: { roll_no: number | null; cs: { class: { name_bn: string; name_en: string } | null; section: { name: string } | null } | null } | null;
  } | null;
};

function map(r: Raw, isBn: boolean): CertificateRecord {
  const cls = r.student?.enr?.cs?.class;
  const sec = r.student?.enr?.cs?.section?.name;
  return {
    id: r.id,
    created_at: r.created_at,
    cert_no: r.cert_no,
    session: r.session,
    // Testimonials carry `issued_at`, transfer certificates `issue_date`. Two
    // column names for one concept; the template should not have to know.
    issued_at: r.issued_at ?? r.issue_date ?? null,
    parent_name: r.parent_name,
    permanent_address: r.permanent_address,
    conduct: r.conduct ?? null,
    remarks: r.remarks ?? null,
    reason: r.reason ?? null,
    cert_type: r.cert_type ?? null,
    language: r.language,
    name_bn: r.student?.name_bn ?? "",
    name_en: r.student?.name_en ?? "",
    student_code: r.student?.student_code ?? null,
    dob: r.student?.dob ?? null,
    roll: r.student?.enr?.roll_no ?? null,
    class_name: cls ? `${isBn ? cls.name_bn : cls.name_en}${sec ? ` · ${sec}` : ""}` : null,
  };
}

export async function fetchCertificate(
  s: BrowserClient,
  kind: "testimonial" | "transfer",
  id: string,
  isBn: boolean,
): Promise<CertificateRecord | null> {
  if (kind === "testimonial") {
    const { data, error } = await s
      .from("testimonial")
      .select(`id, created_at, cert_no, session, issued_at, parent_name, permanent_address, conduct, remarks, language, ${STUDENT}`)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? map(data as unknown as Raw, isBn) : null;
  }
  const { data, error } = await s
    .from("transfer_certificate")
    .select(`id, created_at, cert_no, session, issue_date, parent_name, permanent_address, reason, cert_type, language, ${STUDENT}`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? map(data as unknown as Raw, isBn) : null;
}
