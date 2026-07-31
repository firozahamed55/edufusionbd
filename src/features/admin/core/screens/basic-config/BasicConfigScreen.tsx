"use client";

import { useEffect, useMemo, useState } from "react";
import { useUnsavedGuard } from "@/shared/lib/useUnsavedGuard";
import { useT } from "@/shared/i18n/useT";
import { FormCard, Field, Input, Select, Button, Skeleton, SaveBar, UnsavedDot, useToast } from "@/shared/ui";
import { useSetting, useSaveSetting, useGradeSchemes } from "../../logic/hooks";
import { useErrorMessage } from "@/shared/services/errors";
import type { RpcPayload } from "@/shared/services/supabase/types";
import type { Json } from "@/shared/types/database.types";

const SETTING_KEY = "basic_config";
const SCOPE = "core";

const MONTHS = [
  ["january", "জানুয়ারি", "January"], ["february", "ফেব্রুয়ারি", "February"], ["march", "মার্চ", "March"],
  ["april", "এপ্রিল", "April"], ["may", "মে", "May"], ["june", "জুন", "June"],
  ["july", "জুলাই", "July"], ["august", "আগস্ট", "August"], ["september", "সেপ্টেম্বর", "September"],
  ["october", "অক্টোবর", "October"], ["november", "নভেম্বর", "November"], ["december", "ডিসেম্বর", "December"],
] as const;
const DAYS = [
  ["sunday", "রবিবার", "Sunday"], ["monday", "সোমবার", "Monday"], ["tuesday", "মঙ্গলবার", "Tuesday"],
  ["wednesday", "বুধবার", "Wednesday"], ["thursday", "বৃহস্পতিবার", "Thursday"], ["friday", "শুক্রবার", "Friday"], ["saturday", "শনিবার", "Saturday"],
] as const;
const WORKING_DAYS = [
  ["sun_thu", "রবি – বৃহস্পতি", "Sun – Thu"], ["sat_thu", "শনি – বৃহস্পতি", "Sat – Thu"], ["mon_fri", "সোম – শুক্র", "Mon – Fri"],
] as const;
const WEEKENDS = [
  ["fri_sat", "শুক্র – শনি", "Fri – Sat"], ["sat_sun", "শনি – রবি", "Sat – Sun"], ["fri_only", "শুক্রবার", "Friday only"],
] as const;
const LANGUAGES = [["bn", "বাংলা", "Bangla"], ["en", "English", "English"]] as const;
const CURRENCIES = [["BDT", "৳ টাকা (BDT)", "৳ Taka (BDT)"], ["USD", "$ ডলার (USD)", "$ Dollar (USD)"]] as const;
const DATE_FORMATS = [["DD/MM/YYYY", "DD/MM/YYYY", "DD/MM/YYYY"], ["YYYY-MM-DD", "YYYY-MM-DD", "YYYY-MM-DD"], ["MM/DD/YYYY", "MM/DD/YYYY", "MM/DD/YYYY"]] as const;
const NUMBER_SYSTEMS = [["bn", "বাংলা সংখ্যা", "Bangla numerals"], ["en", "ইংরেজি সংখ্যা", "English numerals"]] as const;
const ATTENDANCE_TYPES = [["daily", "দৈনিক", "Daily"], ["period", "পিরিয়ড-ভিত্তিক", "Per-period"]] as const;

type Toggle = { key: string; bn: string; en: string; sub_bn: string; sub_en: string };
const TOGGLES: Toggle[] = [
  { key: "parent_sms_notification", bn: "অভিভাবক SMS বিজ্ঞপ্তি", en: "Parent SMS notifications", sub_bn: "অনুপস্থিতি, ফলাফল ও ফি বিষয়ে স্বয়ংক্রিয় বার্তা", sub_en: "Automatic messages for absence, results & fees" },
  { key: "edusathi_ai_assistant", bn: "EduSathi AI সহকারী", en: "EduSathi AI assistant", sub_bn: "স্টাফদের জন্য AI সহকারী সক্রিয় করুন", sub_en: "Enable the AI assistant for staff" },
  { key: "online_fee_payment", bn: "অনলাইন ফি পরিশোধ", en: "Online fee payment", sub_bn: "বিকাশ, নগদ ও কার্ড গেটওয়ে", sub_en: "bKash, Nagad & card gateways" },
  { key: "marksheet_parent_signature", bn: "মার্কশিটে অভিভাবকের স্বাক্ষর", en: "Parent signature on marksheet", sub_bn: "প্রিন্টে স্বাক্ষরের স্থান রাখুন", sub_en: "Leave a signature line on the printout" },
];

function opts(list: readonly (readonly [string, string, string])[], isBn: boolean) {
  return list.map(([value, bn, en]) => ({ value, label: isBn ? bn : en }));
}

/**
 * The handful of keys in this jsonb blob that have a *wrong* value, not just an
 * unset one (SRA A-0.2).
 *
 * Deliberately partial. `institution_setting` is an open jsonb document and
 * most of what lives here is an enum backed by a `<Select>`, which cannot hold
 * an invalid value. The four numerics can: `daily_periods: 0` silently breaks
 * every routine calculation downstream, and `pass_mark: 500` makes the grading
 * scheme unreachable. ponytail: validate what can be wrong, not everything that
 * exists.
 */
const NUMERIC_RULES: Record<string, { min: number; max: number; bn: string; en: string }> = {
  academic_year: { min: 2000, max: 2100, bn: "শিক্ষাবর্ষ ২০০০–২১০০ এর মধ্যে হতে হবে", en: "Academic year must be between 2000 and 2100" },
  daily_periods: { min: 1, max: 20, bn: "দৈনিক পিরিয়ড ১–২০ এর মধ্যে হতে হবে", en: "Daily periods must be between 1 and 20" },
  period_duration: { min: 5, max: 240, bn: "পিরিয়ডের সময়কাল ৫–২৪০ মিনিট হতে হবে", en: "Period duration must be 5–240 minutes" },
  pass_mark: { min: 1, max: 100, bn: "পাস মার্ক ১–১০০ এর মধ্যে হতে হবে", en: "Pass mark must be between 1 and 100" },
};

export function BasicConfigScreen() {
  const { t, isBn } = useT();
  const msg = useErrorMessage();
  const toast = useToast();
  const config = useSetting(SETTING_KEY, SCOPE);
  const schemes = useGradeSchemes();
  const save = useSaveSetting(SETTING_KEY, SCOPE);
  const [form, setForm] = useState<RpcPayload>({});
  const [dirty, setDirty] = useState(false);
  const [touched, setTouched] = useState<Set<string>>(new Set());

  useEffect(() => { if (config.data) setForm({ ...config.data }); }, [config.data]);
  const set = (k: string, v: Json) => { setForm((p) => ({ ...p, [k]: v })); setDirty(true); };

  // Settings survive a browser close far worse than a form does: the operator
  // has no draft and no record of what they changed.
  useUnsavedGuard(dirty);

  const errors = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [key, rule] of Object.entries(NUMERIC_RULES)) {
      const raw = form[key];
      if (raw === undefined || raw === null || raw === "") continue;
      const value = Number(raw);
      if (!Number.isFinite(value) || value < rule.min || value > rule.max) {
        out[key] = t(rule.bn, rule.en);
      }
    }
    return out;
  }, [form, t]);

  /** `error` + `touch` in one spread — see the note on `Field`'s `onBlur`. */
  const bind = (k: string) => ({
    error: touched.has(k) ? errors[k] : undefined,
    onBlur: () => setTouched((p) => (p.has(k) ? p : new Set(p).add(k))),
  });

  function onSave() {
    if (Object.keys(errors).length > 0) {
      setTouched(new Set(Object.keys(NUMERIC_RULES)));
      toast({ title: t("চিহ্নিত ফিল্ডগুলো ঠিক করুন", "Fix the highlighted fields"), variant: "error" });
      return;
    }
    save.mutate(form, {
      onSuccess: () => { toast({ title: t("সংরক্ষিত হয়েছে", "Saved"), variant: "success" }); setDirty(false); setTouched(new Set()); },
      onError: (e: unknown) => toast({ title: msg(e, { bn: "সংরক্ষণ ব্যর্থ", en: "Save failed" }), variant: "error" }),
    });
  }
  function onReset() { setForm({ ...(config.data ?? {}) }); setDirty(false); setTouched(new Set()); }

  return (
    <div className="flex flex-col gap-5 pb-6">
      <header>
        <h1 className="mt-1.5 text-h4 font-bold text-text-primary">{t("বেসিক কনফিগারেশন", "Basic Configuration")}</h1>
        <p className="mt-1 text-meta text-text-muted">{t("একাডেমিক, আঞ্চলিক ও ডিফল্ট নীতিমালা", "Academic, regional & default policies")}</p>
      </header>

      {config.isLoading ? (
        <div className="flex flex-col gap-3 rounded-2xl bg-surface p-6 shadow-e1">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-11" />)}</div>
      ) : (
        <>
          <FormCard title={t("একাডেমিক সেটিংস", "Academic Settings")}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label={t("চলতি শিক্ষাবর্ষ", "Current academic year")} {...bind("academic_year")}>
                <Input type="number" value={String(form.academic_year ?? "")} onChange={(e) => set("academic_year", e.target.value)} className="font-latin" />
              </Field>
              <Field label={t("সেশন শুরুর মাস", "Session start month")}>
                <Select value={String(form.session_start_month ?? "")} placeholder={t("নির্বাচন করুন", "Select")} options={opts(MONTHS, isBn)} onChange={(e) => set("session_start_month", e.target.value)} />
              </Field>
              <Field label={t("সপ্তাহ শুরু", "Week start day")}>
                <Select value={String(form.week_start_day ?? "")} placeholder={t("নির্বাচন করুন", "Select")} options={opts(DAYS, isBn)} onChange={(e) => set("week_start_day", e.target.value)} />
              </Field>
              <Field label={t("কার্যদিবস", "Working days")}>
                <Select value={String(form.working_days ?? "")} placeholder={t("নির্বাচন করুন", "Select")} options={opts(WORKING_DAYS, isBn)} onChange={(e) => set("working_days", e.target.value)} />
              </Field>
              <Field label={t("দৈনিক পিরিয়ড সংখ্যা", "Daily periods")} {...bind("daily_periods")}>
                <Input type="number" min={1} value={String(form.daily_periods ?? "")} onChange={(e) => set("daily_periods", e.target.value)} className="font-latin" />
              </Field>
              <Field label={t("পিরিয়ড সময়কাল (মিনিট)", "Period duration (minutes)")} {...bind("period_duration")}>
                <Input type="number" min={1} value={String(form.period_duration ?? "")} onChange={(e) => set("period_duration", e.target.value)} className="font-latin" />
              </Field>
            </div>
          </FormCard>

          <FormCard title={t("আঞ্চলিক সেটিংস", "Regional Settings")}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label={t("ডিফল্ট ভাষা", "Default language")}>
                <Select value={String(form.default_language ?? "")} placeholder={t("নির্বাচন করুন", "Select")} options={opts(LANGUAGES, isBn)} onChange={(e) => set("default_language", e.target.value)} />
              </Field>
              <Field label={t("টাইমজোন", "Timezone")}>
                <Input value="Asia/Dhaka (GMT+6)" disabled className="font-latin" />
              </Field>
              <Field label={t("মুদ্রা", "Currency")}>
                <Select value={String(form.currency ?? "")} placeholder={t("নির্বাচন করুন", "Select")} options={opts(CURRENCIES, isBn)} onChange={(e) => set("currency", e.target.value)} />
              </Field>
              <Field label={t("তারিখ ফরম্যাট", "Date format")}>
                <Select value={String(form.date_format ?? "")} placeholder={t("নির্বাচন করুন", "Select")} options={opts(DATE_FORMATS, isBn)} onChange={(e) => set("date_format", e.target.value)} />
              </Field>
              <Field label={t("সংখ্যা পদ্ধতি", "Number system")}>
                <Select value={String(form.number_system ?? "")} placeholder={t("নির্বাচন করুন", "Select")} options={opts(NUMBER_SYSTEMS, isBn)} onChange={(e) => set("number_system", e.target.value)} />
              </Field>
              <Field label={t("সপ্তাহান্ত", "Weekend")}>
                <Select value={String(form.weekend ?? "")} placeholder={t("নির্বাচন করুন", "Select")} options={opts(WEEKENDS, isBn)} onChange={(e) => set("weekend", e.target.value)} />
              </Field>
            </div>
          </FormCard>

          <FormCard title={t("ডিফল্ট নীতিমালা", "Default Policies")}>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label={t("গ্রেডিং সিস্টেম", "Grading system")}>
                  <Select
                    value={String(form.grading_system_id ?? "")}
                    placeholder={t("নির্বাচন করুন", "Select")}
                    options={(schemes.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
                    onChange={(e) => set("grading_system_id", e.target.value)}
                  />
                </Field>
                <Field label={t("পাস মার্ক (%)", "Pass mark (%)")} {...bind("pass_mark")}>
                  <Input type="number" min={0} max={100} value={String(form.pass_mark ?? "")} onChange={(e) => set("pass_mark", e.target.value)} className="font-latin" />
                </Field>
                <Field label={t("উপস্থিতির ধরন", "Attendance type")}>
                  <Select value={String(form.attendance_type ?? "")} placeholder={t("নির্বাচন করুন", "Select")} options={opts(ATTENDANCE_TYPES, isBn)} onChange={(e) => set("attendance_type", e.target.value)} />
                </Field>
              </div>

              <div className="flex flex-col gap-1">
                {TOGGLES.map((tg, i) => (
                  <div key={tg.key} className={i > 0 ? "flex items-center gap-3 border-t border-border-default py-3.5" : "flex items-center gap-3 py-1.5"}>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-text-primary">{t(tg.bn, tg.en)}</p>
                      <p className="mt-0.5 text-xs text-text-muted">{t(tg.sub_bn, tg.sub_en)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => set(tg.key, !form[tg.key])}
                      aria-label={t(tg.bn, tg.en)}
                      className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors ${form[tg.key] ? "bg-primary" : "bg-border-strong"}`}
                    >
                      <span className={`absolute size-5 rounded-full bg-white transition-all ${form[tg.key] ? "right-0.5" : "left-0.5"}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </FormCard>

          <SaveBar status={dirty ? <><UnsavedDot /> {t("অসংরক্ষিত পরিবর্তন", "Unsaved changes")}</> : null}>
            <Button variant="secondary" onClick={onReset} disabled={!dirty}>{t("রিসেট", "Reset")}</Button>
            <Button variant="primary" onClick={onSave} disabled={save.isPending || !dirty}>{save.isPending ? t("সংরক্ষণ হচ্ছে…", "Saving…") : t("সংরক্ষণ করুন", "Save")}</Button>
          </SaveBar>
        </>
      )}
    </div>
  );
}
