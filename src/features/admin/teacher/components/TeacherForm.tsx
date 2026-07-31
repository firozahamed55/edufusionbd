"use client";

import { useEffect, useState } from "react";
import { User, FileText, Upload, Info } from "lucide-react";
import { GENDER, RELIGION, BLOOD_GROUP, EMPLOYMENT_TYPE, BLOOD_TOKEN } from "@/shared/constants/enums";
import { useT } from "@/shared/i18n/useT";
import { useQueryState } from "@/shared/lib/useQueryState";
import { Button, FormCard, Field, Input, Select, SaveBar, UnsavedDot, useToast } from "@/shared/ui";
import {
  useDivisions,
  useDistricts,
  useUpazilas,
  useDesignations,
  useDepartments,
  useSubjects,
} from "@/shared/services/lookups/hooks";
import type { Option } from "@/shared/services/lookups/api";
import {
  useTeacherOptions,
  useTeacherDetail,
  useRegisterTeacher,
  useUpdateTeacher,
} from "../logic/hooks";
import type { TeacherFormValues, TeacherWritePayload } from "../logic/api";
import { useErrorMessage } from "@/shared/services/errors";

/**
 * Shared teacher form — used by both Registration and Update Profile, which are
 * the same Figma layout (139:2 / 161:2) differing only in title, breadcrumb,
 * teacher selector and save-bar actions. One component → zero duplication.
 * Fully live: reference data + writes go through Supabase (RLS-scoped).
 */

type FormState = TeacherFormValues & { same_as_present: boolean };

const EMPTY: FormState = {
  id: "",
  employee_code: "",
  name_bn: "",
  name_en: "",
  dob: "",
  gender: "",
  blood_group: "",
  religion: "",
  nid: "",
  nationality: "বাংলাদেশি",
  designation_id: "",
  department_id: "",
  main_subject_id: "",
  joining_date: "",
  employment_type: "",
  email: "",
  mobile: "",
  alt_mobile: "",
  emergency_contact_name: "",
  emergency_contact_relation: "",
  emergency_contact_number: "",
  highest_degree: "",
  experience_years: "",
  present_division_id: "",
  present_district_id: "",
  present_upazila_id: "",
  present_village: "",
  present_house_road: "",
  same_as_present: false,
  permanent_division_id: "",
  permanent_district_id: "",
  permanent_upazila_id: "",
  permanent_village: "",
  permanent_house_road: "",
};

const DOCS = ["জাতীয় পরিচয়পত্র", "শিক্ষাগত সনদপত্র", "সিভি / জীবনবৃত্তান্ত"] as const;

export function TeacherForm({ mode }: { mode: "register" | "update" }) {
  const isRegister = mode === "register";
  const { t, isBn } = useT();
  const msg = useErrorMessage();
  const toast = useToast();

  // URL-backed so "Edit profile" from the directory opens THAT teacher
  // (?id=…) instead of a blank picker, and so the view is linkable.
  const [{ id: selectedId }, setSelected] = useQueryState({ id: "" });
  const setSelectedId = (id: string) => setSelected({ id });
  const [f, setF] = useState<FormState>({ ...EMPTY });
  const up = (k: keyof FormState, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));

  // Reference data (RLS-scoped tenant lookups + global geo cascade).
  const designations = useDesignations();
  const departments = useDepartments();
  const subjects = useSubjects();
  const divisions = useDivisions();
  const pDistricts = useDistricts(f.present_division_id || null);
  const pUpazilas = useUpazilas(f.present_district_id || null);
  const permDistricts = useDistricts(f.permanent_division_id || null);
  const permUpazilas = useUpazilas(f.permanent_district_id || null);

  // Update mode: teacher picker + hydrate.
  const teachers = useTeacherOptions();
  const detail = useTeacherDetail(!isRegister && selectedId ? selectedId : null);
  useEffect(() => {
    if (detail.data) setF({ ...EMPTY, ...detail.data });
  }, [detail.data]);

  const register = useRegisterTeacher();
  const update = useUpdateTeacher();
  const isPending = register.isPending || update.isPending;

  const opt = (list?: Option[]) =>
    (list ?? []).map((o) => ({ value: o.value, label: isBn ? o.label_bn : o.label_en }));
  const PICK = t("নির্বাচন করুন", "Select");
  const RELATION = [
    { value: "spouse", label: t("স্বামী/স্ত্রী", "Spouse") },
    { value: "parent", label: t("পিতা/মাতা", "Parent") },
    { value: "sibling", label: t("ভাই/বোন", "Sibling") },
    { value: "other", label: t("অন্যান্য", "Other") },
  ];

  const coreFilled =
    f.name_bn && f.name_en && f.dob && f.gender && f.designation_id &&
    f.department_id && f.main_subject_id && f.email && f.emergency_contact_relation && f.mobile;
  const canSubmit = Boolean(coreFilled) && (isRegister || Boolean(f.id));

  function buildPayload(): TeacherWritePayload {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, employee_code, same_as_present, blood_group, ...rest } = f;
    return {
      ...rest,
      blood_group: blood_group ? BLOOD_TOKEN[blood_group] ?? "" : "",
      ...(same_as_present
        ? {
            permanent_division_id: f.present_division_id,
            permanent_district_id: f.present_district_id,
            permanent_upazila_id: f.present_upazila_id,
            permanent_village: f.present_village,
            permanent_house_road: f.present_house_road,
          }
        : {}),
    };
  }

  function submit() {
    if (!canSubmit) {
      toast({ title: t("প্রয়োজনীয় ফিল্ড পূরণ করুন", "Please fill the required fields"), variant: "error" });
      return;
    }
    const payload = buildPayload();
    if (isRegister) {
      register.mutate(payload, {
        onSuccess: () => {
          toast({ title: t("শিক্ষক সফলভাবে নিবন্ধিত হয়েছে", "Teacher registered successfully"), variant: "success" });
          setF({ ...EMPTY });
        },
        onError: (e: unknown) =>
          toast({ title: msg(e, { bn: "সংরক্ষণ ব্যর্থ", en: "Save failed" }), variant: "error" }),
      });
    } else {
      update.mutate(
        { ...payload, id: f.id },
        {
          onSuccess: () => toast({ title: t("প্রোফাইল হালনাগাদ হয়েছে", "Profile updated"), variant: "success" }),
          onError: (e: unknown) =>
            toast({ title: msg(e, { bn: "সংরক্ষণ ব্যর্থ", en: "Save failed" }), variant: "error" }),
        },
      );
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="mt-1.5 text-h4 font-bold text-text-primary">
          {isRegister ? t("নতুন শিক্ষক নিবন্ধন", "New Teacher Registration") : t("শিক্ষক প্রোফাইল হালনাগাদ", "Update Teacher Profile")}
        </h1>
        <p className="mt-1 text-meta text-text-muted">
          {isRegister
            ? t("শিক্ষকের ব্যক্তিগত তথ্য, পদবি ও যোগাযোগ যুক্ত করুন", "Add the teacher's personal info, designation and contact")
            : t("বিদ্যমান শিক্ষক নির্বাচন করে তথ্য হালনাগাদ ও সংরক্ষণ করুন", "Select an existing teacher, edit and save")}
        </p>
      </header>

      {!isRegister && (
        <FormCard title={t("শিক্ষক নির্বাচন করুন", "Select Teacher")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field label={t("শিক্ষক", "Teacher")} required>
              <Select
                value={selectedId}
                placeholder={teachers.isLoading ? t("লোড হচ্ছে…", "Loading…") : PICK}
                options={(teachers.data ?? []).map((o) => ({ value: o.value, label: o.label }))}
                onChange={(e) => setSelectedId(e.target.value)}
              />
            </Field>
            {f.employee_code ? (
              <span className="pb-2.5 text-meta font-semibold text-primary font-latin">{f.employee_code}</span>
            ) : null}
          </div>
          {detail.isLoading && selectedId ? (
            <p className="text-meta text-text-muted">{t("তথ্য লোড হচ্ছে…", "Loading details…")}</p>
          ) : null}
        </FormCard>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_360px]">
        {/* LEFT */}
        <div className="flex flex-col gap-5">
          <FormCard title={t("শিক্ষকের মৌলিক তথ্য", "Teacher Basic Info")}>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label={t("পূর্ণ নাম (বাংলা)", "Full Name (Bangla)")} required>
                  <Input value={f.name_bn} onChange={(e) => up("name_bn", e.target.value)} placeholder="মোঃ রফিকুল ইসলাম" />
                </Field>
                <Field label={t("Full Name (English)", "Full Name (English)")} required>
                  <Input value={f.name_en} onChange={(e) => up("name_en", e.target.value)} placeholder="Md. Rafiqul Islam" className="font-latin" />
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Field label={t("জন্ম তারিখ", "Date of Birth")} required>
                  <Input type="date" value={f.dob} onChange={(e) => up("dob", e.target.value)} />
                </Field>
                <Field label={t("লিঙ্গ", "Gender")} required>
                  <Select value={f.gender} onChange={(e) => up("gender", e.target.value)} placeholder={PICK}
                    options={GENDER.map((g) => ({ value: g.value, label: isBn ? g.bn : g.en }))} />
                </Field>
                <Field label={t("রক্তের গ্রুপ", "Blood Group")}>
                  <Select value={f.blood_group} onChange={(e) => up("blood_group", e.target.value)} placeholder={PICK}
                    options={BLOOD_GROUP.map((b) => ({ value: b, label: b }))} />
                </Field>
                <Field label={t("ধর্ম", "Religion")}>
                  <Select value={f.religion} onChange={(e) => up("religion", e.target.value)} placeholder={PICK}
                    options={RELIGION.map((r) => ({ value: r.value, label: isBn ? r.bn : r.en }))} />
                </Field>
                <Field label={t("জাতীয় পরিচয়পত্র", "NID")}>
                  <Input value={f.nid} onChange={(e) => up("nid", e.target.value)} placeholder={t("১০/১৭ ডিজিট", "10/17 digits")} className="font-latin" />
                </Field>
                <Field label={t("জাতীয়তা", "Nationality")}>
                  <Input value={f.nationality} onChange={(e) => up("nationality", e.target.value)} />
                </Field>
              </div>
            </div>
          </FormCard>

          <FormCard title={t("চাকরি বিবরণ", "Job Details")}>
            <div className="grid grid-cols-3 gap-4">
              <Field label={t("পদবি", "Designation")} required>
                <Select value={f.designation_id} onChange={(e) => up("designation_id", e.target.value)} placeholder={PICK} options={opt(designations.data)} />
              </Field>
              <Field label={t("বিভাগ", "Department")} required>
                <Select value={f.department_id} onChange={(e) => up("department_id", e.target.value)} placeholder={PICK} options={opt(departments.data)} />
              </Field>
              <Field label={t("মূল বিষয়", "Main Subject")} required>
                <Select value={f.main_subject_id} onChange={(e) => up("main_subject_id", e.target.value)} placeholder={PICK} options={opt(subjects.data)} />
              </Field>
              <Field label={t("কর্মচারী আইডি", "Employee ID")}>
                <Input value={f.employee_code} placeholder={isRegister ? t("সংরক্ষণে স্বয়ংক্রিয়", "auto on save") : ""} disabled className="font-latin" />
              </Field>
              <Field label={t("যোগদানের তারিখ", "Joining Date")}>
                <Input type="date" value={f.joining_date} onChange={(e) => up("joining_date", e.target.value)} />
              </Field>
              <Field label={t("নিয়োগের ধরন", "Employment Type")}>
                <Select value={f.employment_type} onChange={(e) => up("employment_type", e.target.value)} placeholder={PICK}
                  options={EMPLOYMENT_TYPE.map((a) => ({ value: a.value, label: isBn ? a.bn : a.en }))} />
              </Field>
            </div>
          </FormCard>

          <FormCard title={t("যোগাযোগ ও যোগ্যতা", "Contact & Qualification")}>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label={t("ইমেইল", "Email")} required>
                  <Input type="email" value={f.email} onChange={(e) => up("email", e.target.value)} placeholder="name@school.edu.bd" className="font-latin" />
                </Field>
                <Field label={t("জরুরি যোগাযোগ সম্পর্ক", "Emergency Contact Relation")} required>
                  <Select value={f.emergency_contact_relation} onChange={(e) => up("emergency_contact_relation", e.target.value)} placeholder={PICK} options={RELATION} />
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Field label={t("মোবাইল নম্বর", "Mobile No.")} required>
                  <Input value={f.mobile} onChange={(e) => up("mobile", e.target.value)} placeholder="01XXXXXXXXX" className="font-latin" />
                </Field>
                <Field label={t("বিকল্প মোবাইল", "Alt. Mobile")}>
                  <Input value={f.alt_mobile} onChange={(e) => up("alt_mobile", e.target.value)} placeholder={t("ঐচ্ছিক", "optional")} className="font-latin" />
                </Field>
                <Field label={t("জরুরি যোগাযোগ নম্বর", "Emergency No.")}>
                  <Input value={f.emergency_contact_number} onChange={(e) => up("emergency_contact_number", e.target.value)} placeholder="01XXXXXXXXX" className="font-latin" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label={t("জরুরি যোগাযোগ নাম", "Emergency Contact Name")}>
                  <Input value={f.emergency_contact_name} onChange={(e) => up("emergency_contact_name", e.target.value)} placeholder={t("পূর্ণ নাম", "Full name")} />
                </Field>
                <Field label={t("সর্বোচ্চ ডিগ্রি", "Highest Degree")}>
                  <Input value={f.highest_degree} onChange={(e) => up("highest_degree", e.target.value)} placeholder={t("যেমন: বিএসসি/এমএ", "e.g. BSc/MA")} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label={t("অভিজ্ঞতা (বছর)", "Experience (years)")}>
                  <Input type="number" min={0} value={f.experience_years} onChange={(e) => up("experience_years", e.target.value)} placeholder={t("ঐচ্ছিক", "optional")} className="font-latin" />
                </Field>
              </div>
            </div>
          </FormCard>

          <FormCard title={t("ঠিকানা", "Address")}>
            <div className="flex flex-col gap-4">
              <p className="text-meta font-semibold text-text-secondary">{t("বর্তমান ঠিকানা", "Present Address")}</p>
              <div className="grid grid-cols-3 gap-4">
                <Field label={t("বিভাগ", "Division")}>
                  <Select value={f.present_division_id} placeholder={PICK} options={opt(divisions.data)}
                    onChange={(e) => setF((p) => ({ ...p, present_division_id: e.target.value, present_district_id: "", present_upazila_id: "" }))} />
                </Field>
                <Field label={t("জেলা", "District")}>
                  <Select value={f.present_district_id} placeholder={PICK} options={opt(pDistricts.data)}
                    onChange={(e) => setF((p) => ({ ...p, present_district_id: e.target.value, present_upazila_id: "" }))} />
                </Field>
                <Field label={t("উপজেলা", "Upazila")}>
                  <Select value={f.present_upazila_id} placeholder={PICK} options={opt(pUpazilas.data)}
                    onChange={(e) => up("present_upazila_id", e.target.value)} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label={t("গ্রাম/মহল্লা", "Village/Area")}>
                  <Input value={f.present_village} onChange={(e) => up("present_village", e.target.value)} placeholder={t("যেমন: রামপুর", "e.g. Rampur")} />
                </Field>
                <Field label={t("বাড়ি/হোল্ডিং ও রোড নং", "House/Road No.")}>
                  <Input value={f.present_house_road} onChange={(e) => up("present_house_road", e.target.value)} placeholder={t("বাড়ি নং, রোড নং", "House, Road")} />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm text-text-secondary">
                <input type="checkbox" checked={f.same_as_present} onChange={(e) => up("same_as_present", e.target.checked)} className="size-4 accent-primary" />
                {t("স্থায়ী ঠিকানা বর্তমান ঠিকানার সাথে একই", "Permanent address same as present")}
              </label>
              {!f.same_as_present && (
                <>
                  <p className="text-meta font-semibold text-text-secondary">{t("স্থায়ী ঠিকানা", "Permanent Address")}</p>
                  <div className="grid grid-cols-3 gap-4">
                    <Field label={t("বিভাগ", "Division")}>
                      <Select value={f.permanent_division_id} placeholder={PICK} options={opt(divisions.data)}
                        onChange={(e) => setF((p) => ({ ...p, permanent_division_id: e.target.value, permanent_district_id: "", permanent_upazila_id: "" }))} />
                    </Field>
                    <Field label={t("জেলা", "District")}>
                      <Select value={f.permanent_district_id} placeholder={PICK} options={opt(permDistricts.data)}
                        onChange={(e) => setF((p) => ({ ...p, permanent_district_id: e.target.value, permanent_upazila_id: "" }))} />
                    </Field>
                    <Field label={t("উপজেলা", "Upazila")}>
                      <Select value={f.permanent_upazila_id} placeholder={PICK} options={opt(permUpazilas.data)}
                        onChange={(e) => up("permanent_upazila_id", e.target.value)} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label={t("গ্রাম/মহল্লা", "Village/Area")}>
                      <Input value={f.permanent_village} onChange={(e) => up("permanent_village", e.target.value)} />
                    </Field>
                    <Field label={t("বাড়ি/হোল্ডিং ও রোড নং", "House/Road No.")}>
                      <Input value={f.permanent_house_road} onChange={(e) => up("permanent_house_road", e.target.value)} />
                    </Field>
                  </div>
                </>
              )}
            </div>
          </FormCard>
        </div>

        {/* RIGHT rail: photo / documents (upload wired in a later pass) */}
        <div className="flex flex-col gap-5">
          <FormCard>
            <h2 className="text-center text-base font-semibold text-text-primary">{t("শিক্ষকের ছবি", "Teacher Photo")}</h2>
            <div className="flex flex-col items-center gap-2.5 rounded-xl border border-dashed border-border-strong bg-sunken px-5 py-6 text-center">
              <span className="grid size-14 place-items-center rounded-xl bg-primary-subtle text-primary">
                <User size={26} />
              </span>
              <p className="text-sm font-medium text-text-secondary">{t("ছবি টেনে আনুন বা নির্বাচন করুন", "Drag or select a photo")}</p>
              <p className="text-xs text-text-muted">JPG/PNG • {t("সর্বোচ্চ ২ MB", "max 2 MB")}</p>
            </div>
          </FormCard>

          <FormCard title={t("ডকুমেন্ট", "Documents")}>
            <div className="flex flex-col gap-2">
              {DOCS.map((doc) => (
                <div key={doc} className="flex items-center gap-3 rounded-lg border border-border-default bg-surface px-3 py-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-sunken text-text-secondary">
                    <FileText size={16} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-meta text-text-secondary">{doc}</span>
                  <button className="flex shrink-0 items-center gap-1 text-meta font-semibold text-primary hover:underline">
                    <Upload size={14} /> {t("আপলোড", "Upload")}
                  </button>
                </div>
              ))}
            </div>
          </FormCard>

          <div className="flex gap-2.5 rounded-xl border border-info-fg/30 bg-info-bg p-3.5 text-meta leading-relaxed text-info-fg">
            <Info size={16} className="mt-0.5 shrink-0" />
            <p>{t("* চিহ্নিত ফিল্ডগুলো অবশ্যই পূরণ করতে হবে। কর্মচারী আইডি সংরক্ষণের সময় স্বয়ংক্রিয়ভাবে তৈরি হবে।", "* Required fields must be filled. Employee ID is generated automatically on save.")}</p>
          </div>
        </div>
      </div>

      <SaveBar
        status={
          <>
            <UnsavedDot />
            <span>{isRegister ? t("নতুন নিবন্ধন ফর্ম", "New registration form") : t("বিদ্যমান শিক্ষক সম্পাদনা", "Editing existing teacher")}</span>
          </>
        }
      >
        <Button variant="secondary" onClick={() => { setF({ ...EMPTY }); setSelectedId(""); }} disabled={isPending}>
          {isRegister ? t("বাতিল", "Reset") : t("বাতিল করুন", "Cancel")}
        </Button>
        <Button variant="primary" onClick={submit} disabled={isPending || !canSubmit}>
          {isPending
            ? t("সংরক্ষণ হচ্ছে…", "Saving…")
            : isRegister
              ? t("নিবন্ধন সম্পন্ন করুন", "Complete Registration")
              : t("সংরক্ষণ করুন", "Save Changes")}
        </Button>
      </SaveBar>
    </div>
  );
}
