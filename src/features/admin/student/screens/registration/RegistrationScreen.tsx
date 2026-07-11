"use client";

import { useEffect, useState } from "react";
import { ChevronRight, UserRound, FileText, Upload, Info } from "lucide-react";
import { GENDER, RELIGION, BLOOD_GROUP } from "@/shared/constants/enums";
import { useT } from "@/shared/i18n/useT";
import { Button, FormCard, Field, Input, Select, SaveBar, UnsavedDot, useToast } from "@/shared/ui";
import {
  useDivisions,
  useDistricts,
  useUpazilas,
  useAcademicYears,
  useClassSectionsLookup,
  useStudentCategories,
} from "@/shared/services/lookups/hooks";
import type { Option } from "@/shared/services/lookups/api";
import { BLOOD_TOKEN, type RegisterPayload } from "./logic/api";
import { useRegisterStudent } from "./logic/useRegisterStudent";

const EMPTY = {
  name_bn: "", name_en: "", dob: "", gender: "", blood_group: "", religion: "",
  birth_reg_no: "", nationality: "বাংলাদেশি",
  academic_year_id: "", class_section_id: "", roll_no: "", admission_date: "", student_category_id: "",
  father_name: "", father_occupation: "",
  guardian_name: "", relationship: "", guardian_mobile: "", guardian_nid: "", monthly_income: "",
  present_division_id: "", present_district_id: "", present_upazila_id: "", present_village: "", present_house_road: "",
  same_as_present: false,
  permanent_division_id: "", permanent_district_id: "", permanent_upazila_id: "", permanent_village: "", permanent_house_road: "",
};

export function RegistrationScreen() {
  const { t, isBn } = useT();
  const toast = useToast();
  const [f, setF] = useState({ ...EMPTY });
  const up = (k: keyof typeof EMPTY, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));

  const years = useAcademicYears();
  const classSections = useClassSectionsLookup();
  const categories = useStudentCategories();
  const divisions = useDivisions();
  const pDistricts = useDistricts(f.present_division_id || null);
  const pUpazilas = useUpazilas(f.present_district_id || null);
  const permDistricts = useDistricts(f.permanent_division_id || null);
  const permUpazilas = useUpazilas(f.permanent_district_id || null);
  const { mutate, isPending } = useRegisterStudent();

  useEffect(() => {
    if (!f.academic_year_id && years.data?.length) up("academic_year_id", years.data[0].value);
  }, [years.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const opt = (list?: Option[]) =>
    (list ?? []).map((o) => ({ value: o.value, label: isBn ? o.label_bn : o.label_en }));
  const PICK = t("নির্বাচন করুন", "Select");

  const canSubmit =
    f.name_bn && f.name_en && f.dob && f.gender && f.guardian_mobile && f.academic_year_id && f.class_section_id;

  function submit() {
    if (!canSubmit) {
      toast({ title: t("প্রয়োজনীয় ফিল্ড পূরণ করুন", "Please fill the required fields"), variant: "error" });
      return;
    }
    const { same_as_present, ...fields } = f;
    const payload: RegisterPayload = {
      ...fields,
      blood_group: f.blood_group ? BLOOD_TOKEN[f.blood_group] ?? "" : "",
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
    mutate(payload, {
      onSuccess: (id) => {
        toast({ title: t("শিক্ষার্থী সফলভাবে ভর্তি হয়েছে", "Student registered successfully"), variant: "success" });
        setF({ ...EMPTY });
        void id;
      },
      onError: (e: unknown) =>
        toast({ title: e instanceof Error ? e.message : t("সংরক্ষণ ব্যর্থ", "Save failed"), variant: "error" }),
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <div className="flex items-center gap-1 text-[13px] text-text-muted">
          <span>{t("শিক্ষার্থী তথ্য", "Student Info")}</span>
          <ChevronRight size={14} />
          <span>{t("নিবন্ধন", "Registration")}</span>
        </div>
        <h1 className="mt-1.5 text-[22px] font-bold text-text-primary">{t("নতুন শিক্ষার্থী ভর্তি", "New Student Admission")}</h1>
        <p className="mt-1 text-[13px] text-text-muted">
          {t("শিক্ষার্থীর তথ্য, শ্রেণি বিন্যাস ও অভিভাবক যুক্ত করুন", "Add student info, class placement and guardian")}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-5">
          {/* Basic info */}
          <FormCard title={t("শিক্ষার্থীর মৌলিক তথ্য", "Student Basic Info")}>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label={t("পূর্ণ নাম (বাংলা)", "Full Name (Bangla)")} required>
                  <Input value={f.name_bn} onChange={(e) => up("name_bn", e.target.value)} placeholder="রাহিম উদ্দিন" />
                </Field>
                <Field label={t("পূর্ণ নাম (English)", "Full Name (English)")} required>
                  <Input value={f.name_en} onChange={(e) => up("name_en", e.target.value)} placeholder="Rahim Uddin" className="font-latin" />
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
                <Field label={t("জন্ম নিবন্ধন নম্বর", "Birth Reg. No.")}>
                  <Input value={f.birth_reg_no} onChange={(e) => up("birth_reg_no", e.target.value)} placeholder={t("১৭ ডিজিট", "17 digits")} />
                </Field>
                <Field label={t("জাতীয়তা", "Nationality")}>
                  <Input value={f.nationality} onChange={(e) => up("nationality", e.target.value)} />
                </Field>
              </div>
            </div>
          </FormCard>

          {/* Class placement */}
          <FormCard title={t("শ্রেণি বিন্যাস", "Class Placement")}>
            <div className="grid grid-cols-3 gap-4">
              <Field label={t("শিক্ষাবর্ষ", "Academic Year")} required>
                <Select value={f.academic_year_id} onChange={(e) => up("academic_year_id", e.target.value)} placeholder={PICK} options={opt(years.data)} />
              </Field>
              <Field label={t("শ্রেণি ও শাখা", "Class & Section")} required className="col-span-2">
                <Select value={f.class_section_id} onChange={(e) => up("class_section_id", e.target.value)} placeholder={PICK} options={opt(classSections.data)} />
              </Field>
              <Field label={t("রোল নম্বর", "Roll No.")}>
                <Input value={f.roll_no} onChange={(e) => up("roll_no", e.target.value)} placeholder={t("স্বয়ংক্রিয়/ম্যানুয়াল", "auto/manual")} />
              </Field>
              <Field label={t("ভর্তির তারিখ", "Admission Date")}>
                <Input type="date" value={f.admission_date} onChange={(e) => up("admission_date", e.target.value)} />
              </Field>
              <Field label={t("শিক্ষার্থী আইডি", "Student ID")}>
                <Input value="" placeholder={t("সংরক্ষণে স্বয়ংক্রিয়", "auto on save")} disabled />
              </Field>
              <Field label={t("শিক্ষার্থী ক্যাটাগরি (পেমেন্ট)", "Fee Category")} className="col-span-3">
                <Select value={f.student_category_id} onChange={(e) => up("student_category_id", e.target.value)} placeholder={PICK} options={opt(categories.data)} />
              </Field>
            </div>
          </FormCard>

          {/* Guardian */}
          <FormCard title={t("অভিভাবক তথ্য", "Guardian Info")}>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t("পিতার নাম", "Father's Name")}>
                <Input value={f.father_name} onChange={(e) => up("father_name", e.target.value)} placeholder={t("পিতার পূর্ণ নাম", "Father's full name")} />
              </Field>
              <Field label={t("পিতার পেশা", "Father's Occupation")}>
                <Input value={f.father_occupation} onChange={(e) => up("father_occupation", e.target.value)} placeholder={t("যেমন: ব্যবসা", "e.g. Business")} />
              </Field>
              <Field label={t("অভিভাবকের নাম", "Guardian's Name")}>
                <Input value={f.guardian_name} onChange={(e) => up("guardian_name", e.target.value)} placeholder={t("পূর্ণ নাম", "Full name")} />
              </Field>
              <Field label={t("সম্পর্ক", "Relationship")}>
                <Select value={f.relationship} onChange={(e) => up("relationship", e.target.value)} placeholder={PICK}
                  options={[
                    { value: "father", label: t("পিতা", "Father") },
                    { value: "mother", label: t("মাতা", "Mother") },
                    { value: "other", label: t("অন্যান্য", "Other") },
                  ]} />
              </Field>
              <Field label={t("মোবাইল নম্বর", "Mobile No.")} required>
                <Input value={f.guardian_mobile} onChange={(e) => up("guardian_mobile", e.target.value)} placeholder="01XXXXXXXXX" className="font-latin" />
              </Field>
              <Field label={t("জাতীয় পরিচয়পত্র", "NID")}>
                <Input value={f.guardian_nid} onChange={(e) => up("guardian_nid", e.target.value)} placeholder={t("১০/১৭ ডিজিট", "10/17 digits")} />
              </Field>
              <Field label={t("মাসিক আয় (৳)", "Monthly Income (৳)")} className="col-span-2">
                <Input value={f.monthly_income} onChange={(e) => up("monthly_income", e.target.value)} placeholder={t("ঐচ্ছিক", "optional")} />
              </Field>
            </div>
          </FormCard>

          {/* Address */}
          <FormCard title={t("ঠিকানা", "Address")}>
            <div className="flex flex-col gap-4">
              <p className="text-[13px] font-semibold text-text-secondary">{t("বর্তমান ঠিকানা", "Present Address")}</p>
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
                  <p className="text-[13px] font-semibold text-text-secondary">{t("স্থায়ী ঠিকানা", "Permanent Address")}</p>
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

        {/* Right rail: photo / documents (upload wired in a later pass) */}
        <div className="flex flex-col gap-5">
          <FormCard>
            <h2 className="text-center text-base font-semibold text-text-primary">{t("শিক্ষার্থীর ছবি", "Student Photo")}</h2>
            <div className="flex flex-col items-center gap-2.5 rounded-xl border border-dashed border-border-strong bg-sunken px-5 py-6 text-center">
              <span className="grid size-14 place-items-center rounded-xl bg-primary-subtle text-primary"><UserRound size={26} /></span>
              <p className="text-sm font-medium text-text-secondary">{t("ছবি টেনে আনুন বা নির্বাচন করুন", "Drag or select a photo")}</p>
              <p className="text-xs text-text-muted">JPG/PNG • {t("সর্বোচ্চ ২ MB", "max 2 MB")}</p>
            </div>
          </FormCard>
          <FormCard title={t("ডকুমেন্ট", "Documents")}>
            <div className="flex flex-col gap-2">
              {[t("জন্ম নিবন্ধন সনদ", "Birth Certificate"), t("পূর্ববর্তী স্কুলের ছাড়পত্র", "Previous School TC"), t("অভিভাবকের NID কপি", "Guardian NID copy")].map((doc) => (
                <div key={doc} className="flex items-center gap-3 rounded-[10px] border border-border-default bg-surface px-3 py-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-sunken text-text-secondary"><FileText size={16} /></span>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-text-secondary">{doc}</span>
                  <button className="flex shrink-0 items-center gap-1 text-[13px] font-semibold text-primary"><Upload size={14} /> {t("আপলোড", "Upload")}</button>
                </div>
              ))}
            </div>
          </FormCard>
          <div className="flex gap-2.5 rounded-xl border border-info-fg/30 bg-info-bg p-3.5 text-[12.5px] leading-relaxed text-info-fg">
            <Info size={16} className="mt-0.5 shrink-0" />
            <p>{t("* চিহ্নিত ফিল্ডগুলো অবশ্যই পূরণ করতে হবে। শিক্ষার্থী আইডি সংরক্ষণের সময় স্বয়ংক্রিয়ভাবে তৈরি হবে।", "* Required fields must be filled. Student ID is generated automatically on save.")}</p>
          </div>
        </div>
      </div>

      <SaveBar
        status={
          <>
            <UnsavedDot />
            <span>{t("নতুন ভর্তি ফর্ম", "New admission form")}</span>
          </>
        }
      >
        <Button variant="secondary" onClick={() => setF({ ...EMPTY })} disabled={isPending}>
          {t("বাতিল", "Reset")}
        </Button>
        <Button variant="primary" onClick={submit} disabled={isPending || !canSubmit}>
          {isPending ? t("সংরক্ষণ হচ্ছে…", "Saving…") : t("ভর্তি সম্পন্ন করুন", "Complete Admission")}
        </Button>
      </SaveBar>
    </div>
  );
}
