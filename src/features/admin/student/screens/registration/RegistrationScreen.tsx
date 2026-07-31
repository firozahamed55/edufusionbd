"use client";

import { useEffect, useState } from "react";
import { UserRound, FileText, Upload, Info } from "lucide-react";
import { GENDER, RELIGION, BLOOD_GROUP } from "@/shared/constants/enums";
import { useT } from "@/shared/i18n/useT";
import { Button, FormCard, Field, Input, Select, Checkbox, SaveBar, UnsavedDot, useToast } from "@/shared/ui";
import { useZodForm } from "@/shared/lib/useZodForm";
import { useUnsavedGuard } from "@/shared/lib/useUnsavedGuard";
import {
  useDivisions,
  useDistricts,
  useUpazilas,
  useAcademicYears,
  useClassSectionsLookup,
  useStudentCategories,
} from "@/shared/services/lookups/hooks";
import type { Option } from "@/shared/services/lookups/api";
import { BLOOD_TOKEN, registerStudentSchema, type RegisterPayload, type RegisterFormValues } from "./logic/api";
import { useRegisterStudent } from "./logic/useRegisterStudent";
import { useErrorMessage } from "@/shared/services/errors";

/**
 * `same_as_present` is deliberately NOT here: it is a UI convenience that copies
 * one address onto another, not a field the RPC stores. Keeping it out of the
 * schema keeps `.strict()` honest.
 */
const EMPTY: RegisterFormValues = {
  name_bn: "", name_en: "", dob: "", gender: "", blood_group: "", religion: "",
  birth_reg_no: "", nationality: "বাংলাদেশি",
  academic_year_id: "", class_section_id: "", roll_no: "", admission_date: "", student_category_id: "",
  father_name: "", father_occupation: "",
  guardian_name: "", relationship: "", guardian_mobile: "", guardian_nid: "", monthly_income: "",
  present_division_id: "", present_district_id: "", present_upazila_id: "", present_village: "", present_house_road: "",
  permanent_division_id: "", permanent_district_id: "", permanent_upazila_id: "", permanent_village: "", permanent_house_road: "",
};

export function RegistrationScreen() {
  const { t, isBn } = useT();
  const msg = useErrorMessage();
  const toast = useToast();
  const [sameAsPresent, setSameAsPresent] = useState(false);

  /**
   * Inline, per-field validation (SRA F-1). This screen used to gate on a
   * boolean and, on failure, fire a toast that named no field — across 31
   * inputs and four cards.
   */
  const form = useZodForm(registerStudentSchema, EMPTY);
  const f = form.values;
  const up = <K extends keyof RegisterFormValues & string>(k: K, v: RegisterFormValues[K]) =>
    form.setValue(k, v);
  /** `error` + `touch` in one spread — see the note on `Field`'s `onBlur`. */
  const bind = (k: keyof RegisterFormValues & string) => ({
    error: form.errors[k],
    onBlur: () => form.touch(k),
  });

  // 31 fields is a lot to lose to a closed tab on a shared school machine.
  useUnsavedGuard(form.isDirty);

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

  function submit() {
    const parsed = form.submit();
    if (!parsed) {
      // The toast now says only that something IS wrong; every field says WHAT.
      toast({ title: t("চিহ্নিত ফিল্ডগুলো ঠিক করুন", "Fix the highlighted fields"), variant: "error" });
      return;
    }
    const payload: RegisterPayload = {
      ...f,
      blood_group: f.blood_group ? BLOOD_TOKEN[f.blood_group] ?? "" : "",
      ...(sameAsPresent
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
        form.reset(EMPTY);
        setSameAsPresent(false);
        void id;
      },
      onError: (e: unknown) =>
        toast({ title: msg(e, { bn: "সংরক্ষণ ব্যর্থ", en: "Save failed" }), variant: "error" }),
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="mt-1.5 text-h4 font-bold text-text-primary">{t("নতুন শিক্ষার্থী ভর্তি", "New Student Admission")}</h1>
        <p className="mt-1 text-meta text-text-muted">
          {t("শিক্ষার্থীর তথ্য, শ্রেণি বিন্যাস ও অভিভাবক যুক্ত করুন", "Add student info, class placement and guardian")}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-5">
          {/* Basic info */}
          <FormCard title={t("শিক্ষার্থীর মৌলিক তথ্য", "Student Basic Info")}>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label={t("পূর্ণ নাম (বাংলা)", "Full Name (Bangla)")} required {...bind("name_bn")}>
                  <Input value={f.name_bn} onChange={(e) => up("name_bn", e.target.value)} placeholder="রাহিম উদ্দিন" />
                </Field>
                <Field label={t("পূর্ণ নাম (English)", "Full Name (English)")} required {...bind("name_en")}>
                  <Input value={f.name_en} onChange={(e) => up("name_en", e.target.value)} placeholder="Rahim Uddin" className="font-latin" />
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label={t("জন্ম তারিখ", "Date of Birth")} required {...bind("dob")}>
                  <Input type="date" value={f.dob} onChange={(e) => up("dob", e.target.value)} />
                </Field>
                <Field label={t("লিঙ্গ", "Gender")} required {...bind("gender")}>
                  <Select value={f.gender} onChange={(e) => up("gender", e.target.value)} placeholder={PICK}
                    options={GENDER.map((g) => ({ value: g.value, label: isBn ? g.bn : g.en }))} />
                </Field>
                <Field label={t("রক্তের গ্রুপ", "Blood Group")} {...bind("blood_group")}>
                  <Select value={f.blood_group} onChange={(e) => up("blood_group", e.target.value)} placeholder={PICK}
                    options={BLOOD_GROUP.map((b) => ({ value: b, label: b }))} />
                </Field>
                <Field label={t("ধর্ম", "Religion")} {...bind("religion")}>
                  <Select value={f.religion} onChange={(e) => up("religion", e.target.value)} placeholder={PICK}
                    options={RELIGION.map((r) => ({ value: r.value, label: isBn ? r.bn : r.en }))} />
                </Field>
                <Field label={t("জন্ম নিবন্ধন নম্বর", "Birth Reg. No.")} {...bind("birth_reg_no")}>
                  <Input value={f.birth_reg_no} onChange={(e) => up("birth_reg_no", e.target.value)} placeholder={t("১৭ ডিজিট", "17 digits")} />
                </Field>
                <Field label={t("জাতীয়তা", "Nationality")} {...bind("nationality")}>
                  <Input value={f.nationality} onChange={(e) => up("nationality", e.target.value)} />
                </Field>
              </div>
            </div>
          </FormCard>

          {/* Class placement */}
          <FormCard title={t("শ্রেণি বিন্যাস", "Class Placement")}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label={t("শিক্ষাবর্ষ", "Academic Year")} required {...bind("academic_year_id")}>
                <Select value={f.academic_year_id} onChange={(e) => up("academic_year_id", e.target.value)} placeholder={PICK} options={opt(years.data)} />
              </Field>
              <Field label={t("শ্রেণি ও শাখা", "Class & Section")} required className="sm:col-span-2" {...bind("class_section_id")}>
                <Select value={f.class_section_id} onChange={(e) => up("class_section_id", e.target.value)} placeholder={PICK} options={opt(classSections.data)} />
              </Field>
              <Field label={t("রোল নম্বর", "Roll No.")} {...bind("roll_no")}>
                <Input value={f.roll_no} onChange={(e) => up("roll_no", e.target.value)} placeholder={t("স্বয়ংক্রিয়/ম্যানুয়াল", "auto/manual")} />
              </Field>
              <Field label={t("ভর্তির তারিখ", "Admission Date")} {...bind("admission_date")}>
                <Input type="date" value={f.admission_date} onChange={(e) => up("admission_date", e.target.value)} />
              </Field>
              <Field label={t("শিক্ষার্থী আইডি", "Student ID")}>
                <Input value="" placeholder={t("সংরক্ষণে স্বয়ংক্রিয়", "auto on save")} disabled />
              </Field>
              <Field label={t("শিক্ষার্থী ক্যাটাগরি (পেমেন্ট)", "Fee Category")} className="sm:col-span-2 lg:col-span-3" {...bind("student_category_id")}>
                <Select value={f.student_category_id} onChange={(e) => up("student_category_id", e.target.value)} placeholder={PICK} options={opt(categories.data)} />
              </Field>
            </div>
          </FormCard>

          {/* Guardian */}
          <FormCard title={t("অভিভাবক তথ্য", "Guardian Info")}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t("পিতার নাম", "Father's Name")} {...bind("father_name")}>
                <Input value={f.father_name} onChange={(e) => up("father_name", e.target.value)} placeholder={t("পিতার পূর্ণ নাম", "Father's full name")} />
              </Field>
              <Field label={t("পিতার পেশা", "Father's Occupation")} {...bind("father_occupation")}>
                <Input value={f.father_occupation} onChange={(e) => up("father_occupation", e.target.value)} placeholder={t("যেমন: ব্যবসা", "e.g. Business")} />
              </Field>
              <Field label={t("অভিভাবকের নাম", "Guardian's Name")} {...bind("guardian_name")}>
                <Input value={f.guardian_name} onChange={(e) => up("guardian_name", e.target.value)} placeholder={t("পূর্ণ নাম", "Full name")} />
              </Field>
              <Field label={t("সম্পর্ক", "Relationship")} {...bind("relationship")}>
                <Select value={f.relationship} onChange={(e) => up("relationship", e.target.value)} placeholder={PICK}
                  options={[
                    { value: "father", label: t("পিতা", "Father") },
                    { value: "mother", label: t("মাতা", "Mother") },
                    { value: "other", label: t("অন্যান্য", "Other") },
                  ]} />
              </Field>
              <Field label={t("মোবাইল নম্বর", "Mobile No.")} required {...bind("guardian_mobile")}>
                <Input value={f.guardian_mobile} onChange={(e) => up("guardian_mobile", e.target.value)} placeholder="01XXXXXXXXX" className="font-latin" />
              </Field>
              <Field label={t("জাতীয় পরিচয়পত্র", "NID")} {...bind("guardian_nid")}>
                <Input value={f.guardian_nid} onChange={(e) => up("guardian_nid", e.target.value)} placeholder={t("১০/১৭ ডিজিট", "10/17 digits")} />
              </Field>
              <Field label={t("মাসিক আয় (৳)", "Monthly Income (৳)")} className="sm:col-span-2" {...bind("monthly_income")}>
                <Input value={f.monthly_income} onChange={(e) => up("monthly_income", e.target.value)} placeholder={t("ঐচ্ছিক", "optional")} />
              </Field>
            </div>
          </FormCard>

          {/* Address */}
          <FormCard title={t("ঠিকানা", "Address")}>
            <div className="flex flex-col gap-4">
              <p className="text-meta font-semibold text-text-secondary">{t("বর্তমান ঠিকানা", "Present Address")}</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label={t("বিভাগ", "Division")} {...bind("present_division_id")}>
                  <Select value={f.present_division_id} placeholder={PICK} options={opt(divisions.data)}
                    onChange={(e) => form.patch({ present_division_id: e.target.value, present_district_id: "", present_upazila_id: "" })} />
                </Field>
                <Field label={t("জেলা", "District")} {...bind("present_district_id")}>
                  <Select value={f.present_district_id} placeholder={PICK} options={opt(pDistricts.data)}
                    onChange={(e) => form.patch({ present_district_id: e.target.value, present_upazila_id: "" })} />
                </Field>
                <Field label={t("উপজেলা", "Upazila")} {...bind("present_upazila_id")}>
                  <Select value={f.present_upazila_id} placeholder={PICK} options={opt(pUpazilas.data)}
                    onChange={(e) => up("present_upazila_id", e.target.value)} />
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label={t("গ্রাম/মহল্লা", "Village/Area")} {...bind("present_village")}>
                  <Input value={f.present_village} onChange={(e) => up("present_village", e.target.value)} placeholder={t("যেমন: রামপুর", "e.g. Rampur")} />
                </Field>
                <Field label={t("বাড়ি/হোল্ডিং ও রোড নং", "House/Road No.")} {...bind("present_house_road")}>
                  <Input value={f.present_house_road} onChange={(e) => up("present_house_road", e.target.value)} placeholder={t("বাড়ি নং, রোড নং", "House, Road")} />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm text-text-secondary">
                {/* Design-system Checkbox, not a raw input: the raw one lost the
                    focus ring and the consistent hit target (SRA A-0.7). */}
                <Checkbox checked={sameAsPresent} onChange={(e) => setSameAsPresent(e.target.checked)} />
                {t("স্থায়ী ঠিকানা বর্তমান ঠিকানার সাথে একই", "Permanent address same as present")}
              </label>
              {!sameAsPresent && (
                <>
                  <p className="text-meta font-semibold text-text-secondary">{t("স্থায়ী ঠিকানা", "Permanent Address")}</p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label={t("বিভাগ", "Division")} {...bind("permanent_division_id")}>
                      <Select value={f.permanent_division_id} placeholder={PICK} options={opt(divisions.data)}
                        onChange={(e) => form.patch({ permanent_division_id: e.target.value, permanent_district_id: "", permanent_upazila_id: "" })} />
                    </Field>
                    <Field label={t("জেলা", "District")} {...bind("permanent_district_id")}>
                      <Select value={f.permanent_district_id} placeholder={PICK} options={opt(permDistricts.data)}
                        onChange={(e) => form.patch({ permanent_district_id: e.target.value, permanent_upazila_id: "" })} />
                    </Field>
                    <Field label={t("উপজেলা", "Upazila")} {...bind("permanent_upazila_id")}>
                      <Select value={f.permanent_upazila_id} placeholder={PICK} options={opt(permUpazilas.data)}
                        onChange={(e) => up("permanent_upazila_id", e.target.value)} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label={t("গ্রাম/মহল্লা", "Village/Area")} {...bind("permanent_village")}>
                      <Input value={f.permanent_village} onChange={(e) => up("permanent_village", e.target.value)} />
                    </Field>
                    <Field label={t("বাড়ি/হোল্ডিং ও রোড নং", "House/Road No.")} {...bind("permanent_house_road")}>
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
                <div key={doc} className="flex items-center gap-3 rounded-lg border border-border-default bg-surface px-3 py-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-sunken text-text-secondary"><FileText size={16} /></span>
                  <span className="min-w-0 flex-1 truncate text-meta text-text-secondary">{doc}</span>
                  <button className="flex shrink-0 items-center gap-1 text-meta font-semibold text-primary hover:underline"><Upload size={14} /> {t("আপলোড", "Upload")}</button>
                </div>
              ))}
            </div>
          </FormCard>
          <div className="flex gap-2.5 rounded-xl border border-info-fg/30 bg-info-bg p-3.5 text-meta leading-relaxed text-info-fg">
            <Info size={16} className="mt-0.5 shrink-0" />
            <p>{t("* চিহ্নিত ফিল্ডগুলো অবশ্যই পূরণ করতে হবে। শিক্ষার্থী আইডি সংরক্ষণের সময় স্বয়ংক্রিয়ভাবে তৈরি হবে।", "* Required fields must be filled. Student ID is generated automatically on save.")}</p>
          </div>
        </div>
      </div>

      <SaveBar
        status={
          <>
            {/* Driven by real dirty state. It was passed statically at every
                call site in the product, i.e. it was decoration (SRA A-0.6). */}
            {form.isDirty ? <UnsavedDot /> : null}
            <span>{form.isDirty ? t("অসংরক্ষিত পরিবর্তন আছে", "Unsaved changes") : t("নতুন ভর্তি ফর্ম", "New admission form")}</span>
          </>
        }
      >
        <Button variant="secondary" onClick={() => { form.reset(EMPTY); setSameAsPresent(false); }} disabled={isPending}>
          {t("বাতিল", "Reset")}
        </Button>
        <Button variant="primary" onClick={submit} disabled={isPending}>
          {isPending ? t("সংরক্ষণ হচ্ছে…", "Saving…") : t("ভর্তি সম্পন্ন করুন", "Complete Admission")}
        </Button>
      </SaveBar>
    </div>
  );
}
