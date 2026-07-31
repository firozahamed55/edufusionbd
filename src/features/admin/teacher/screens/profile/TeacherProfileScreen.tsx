"use client";

import Link from "next/link";
import { History, Mail, Pencil, Phone, User } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import { Skeleton, EmptyState, ErrorState, PageHeader, buttonClass } from "@/shared/ui";
import { useQueryState } from "@/shared/lib/useQueryState";
import { formatDate } from "@/shared/lib/format";
import { GENDER, RELIGION, BLOOD_LABEL } from "@/shared/constants/enums";
import { useErrorMessage } from "@/shared/services/errors";
import { useDesignations, useDepartments, useSubjects } from "@/shared/services/lookups/hooks";
import { useTeacherDetail } from "../../logic/hooks";

/**
 * Teacher · Profile (SRA §6 IA gap — "every stored entity has a detail page").
 *
 * The Directory could open a teacher only into the 31-field edit form. Looking
 * up a colleague's phone number meant entering a form that can save, which is
 * the wrong default for the common case and how records get changed by
 * accident. This is the read view; Edit is one click away and clearly labelled.
 */
export function TeacherProfileScreen() {
  const { t, n, isBn } = useT();
  const msg = useErrorMessage();

  const [{ id }] = useQueryState({ id: "" });
  const q = useTeacherDetail(id || null);
  const designations = useDesignations();
  const departments = useDepartments();
  const subjects = useSubjects();

  const name = (list: { value: string; label_bn: string; label_en: string }[] | undefined, value: string) =>
    list?.find((o) => o.value === value)?.[isBn ? "label_bn" : "label_en"] ?? "—";
  const label = (list: readonly { value: string; bn: string; en: string }[], v?: string) =>
    list.find((x) => x.value === v)?.[isBn ? "bn" : "en"] ?? (v || "—");

  if (!id) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader
          crumbs={[{ label: t("শিক্ষক ও কর্মী", "Teachers & Staff"), href: "/admin/teacher/list" }, { label: t("প্রোফাইল", "Profile") }]}
          title={t("শিক্ষক প্রোফাইল", "Teacher Profile")}
        />
        <EmptyState
          icon={<User size={22} />}
          title={t("কোনো শিক্ষক নির্বাচিত নয়", "No teacher selected")}
          description={t("শিক্ষক তালিকা থেকে একজনের নামে ক্লিক করুন।", "Open a teacher from the Directory.")}
        />
      </div>
    );
  }

  const d = q.data;
  const display = d ? (isBn ? d.name_bn : d.name_en) : "";

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        crumbs={[
          { label: t("শিক্ষক ও কর্মী", "Teachers & Staff"), href: "/admin/teacher/list" },
          { label: display || t("প্রোফাইল", "Profile") },
        ]}
        title={display || t("শিক্ষক প্রোফাইল", "Teacher Profile")}
        subtitle={d ? [name(designations.data, d.designation_id), name(departments.data, d.department_id)].filter((x) => x !== "—").join(" · ") : undefined}
      />

      {q.isError ? (
        <ErrorState title={t("প্রোফাইল লোড করা যায়নি", "Could not load the profile")} description={msg(q.error)} />
      ) : q.isLoading ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : !d ? (
        <EmptyState icon={<User size={22} />} title={t("শিক্ষক পাওয়া যায়নি", "Teacher not found")} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/admin/teacher/update-profile?id=${id}`} className={buttonClass("primary")}>
              <Pencil size={16} /> {t("প্রোফাইল সম্পাদনা", "Edit profile")}
            </Link>
            {d.mobile ? (
              <a href={`tel:${d.mobile}`} className={buttonClass("secondary")}>
                <Phone size={16} /> <span className="font-latin">{d.mobile}</span>
              </a>
            ) : null}
            {d.email ? (
              <a href={`mailto:${d.email}`} className={buttonClass("secondary")}>
                <Mail size={16} /> <span className="font-latin">{d.email}</span>
              </a>
            ) : null}
            <Link href={`/admin/core/audit-log?q=${id}&entity=teacher`} className={buttonClass("secondary")}>
              <History size={16} /> {t("পরিবর্তনের ইতিহাস", "Change history")}
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title={t("পরিচয়", "Identity")}>
              <Row label={t("কর্মী আইডি", "Employee ID")} value={d.employee_code ? n(d.employee_code) : "—"} latin />
              <Row label={t("নাম (বাংলা)", "Name (Bangla)")} value={d.name_bn || "—"} />
              <Row label={t("Name (English)", "Name (English)")} value={d.name_en || "—"} latin />
              <Row label={t("জন্ম তারিখ", "Date of birth")} value={d.dob ? formatDate(d.dob) : "—"} />
              <Row label={t("লিঙ্গ", "Gender")} value={label(GENDER, d.gender)} />
              <Row label={t("ধর্ম", "Religion")} value={label(RELIGION, d.religion)} />
              <Row label={t("রক্তের গ্রুপ", "Blood group")} value={d.blood_group ? BLOOD_LABEL[d.blood_group] ?? d.blood_group : "—"} latin />
              <Row label={t("জাতীয় পরিচয়পত্র", "NID")} value={d.nid || "—"} latin />
            </Card>

            <Card title={t("চাকরি", "Employment")}>
              <Row label={t("পদবি", "Designation")} value={name(designations.data, d.designation_id)} />
              <Row label={t("বিভাগ", "Department")} value={name(departments.data, d.department_id)} />
              <Row label={t("প্রধান বিষয়", "Main subject")} value={name(subjects.data, d.main_subject_id)} />
              <Row label={t("যোগদানের তারিখ", "Joining date")} value={d.joining_date ? formatDate(d.joining_date) : "—"} />
              <Row label={t("নিয়োগের ধরন", "Employment type")} value={d.employment_type || "—"} />
              <Row label={t("সর্বোচ্চ ডিগ্রি", "Highest degree")} value={d.highest_degree || "—"} />
              <Row label={t("অভিজ্ঞতা (বছর)", "Experience (years)")} value={d.experience_years ? n(d.experience_years) : "—"} />
            </Card>

            <Card title={t("যোগাযোগ", "Contact")}>
              <Row label={t("মোবাইল", "Mobile")} value={d.mobile || "—"} latin />
              <Row label={t("বিকল্প মোবাইল", "Alternate mobile")} value={d.alt_mobile || "—"} latin />
              <Row label={t("ইমেইল", "Email")} value={d.email || "—"} latin />
            </Card>

            <Card title={t("জরুরি যোগাযোগ", "Emergency contact")}>
              <Row label={t("নাম", "Name")} value={d.emergency_contact_name || "—"} />
              <Row label={t("সম্পর্ক", "Relationship")} value={d.emergency_contact_relation || "—"} />
              <Row label={t("নম্বর", "Number")} value={d.emergency_contact_number || "—"} latin />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-surface p-5 shadow-e1">
      <p className="mb-2 text-base font-semibold text-text-primary">{title}</p>
      <dl className="grid grid-cols-[minmax(0,10rem)_1fr] gap-x-4 gap-y-2.5">{children}</dl>
    </div>
  );
}

function Row({ label, value, latin }: { label: string; value: string; latin?: boolean }) {
  return (
    <>
      <dt className="text-meta text-text-muted">{label}</dt>
      <dd className={`text-meta font-medium text-text-primary${latin ? " font-latin" : ""}`}>{value}</dd>
    </>
  );
}
