"use client";

import { useEffect, useMemo, useState } from "react";
import { useUnsavedGuard } from "@/shared/lib/useUnsavedGuard";
import { useT } from "@/shared/i18n/useT";
import { FormCard, Field, Input, Select, Button, Skeleton, SaveBar, UnsavedDot, useToast, ConfirmDialog, PageHeader, Switch } from "@/shared/ui";
import { useSetting, useSaveSetting, useGradeSchemes } from "../../logic/hooks";
import { weekendConflict } from "../../logic/schemas";
import { useErrorMessage, classifyError } from "@/shared/services/errors";
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
const NUMBER_SYSTEMS = [["bn", "বাংলা সংখ্যা", "Bangla numerals"], ["en", "ইংরেজি সংখ্যা", "English numerals"]] as const;
const ATTENDANCE_TYPES = [["daily", "দৈনিক", "Daily"], ["period", "পিরিয়ড-ভিত্তিক", "Per-period"]] as const;

type Toggle = { key: string; bn: string; en: string; sub_bn: string; sub_en: string };

/**
 * EduSathi is deliberately NOT in this list any more (audit S-1.7).
 *
 * It is the product's headline differentiator and it sat as the second of four
 * undifferentiated checkboxes — an institution-wide kill switch with no
 * confirmation and no statement of who it affects, rendered identically to
 * "leave a signature line on the printout". It gets its own card below, with
 * the scope controls that make it a configuration surface rather than a
 * boolean.
 */
const TOGGLES: Toggle[] = [
  { key: "parent_sms_notification", bn: "অভিভাবক SMS বিজ্ঞপ্তি", en: "Parent SMS notifications", sub_bn: "অনুপস্থিতি, ফলাফল ও ফি বিষয়ে স্বয়ংক্রিয় বার্তা", sub_en: "Automatic messages for absence, results & fees" },
  { key: "online_fee_payment", bn: "অনলাইন ফি পরিশোধ", en: "Online fee payment", sub_bn: "বিকাশ, নগদ ও কার্ড গেটওয়ে", sub_en: "bKash, Nagad & card gateways" },
  { key: "marksheet_parent_signature", bn: "মার্কশিটে অভিভাবকের স্বাক্ষর", en: "Parent signature on marksheet", sub_bn: "প্রিন্টে স্বাক্ষরের স্থান রাখুন", sub_en: "Leave a signature line on the printout" },
];

/** Which staff roles may use the assistant. Stored as a string array. */
const EDUSATHI_ROLES = [
  ["admin", "অ্যাডমিন", "Administrators"],
  ["teacher", "শিক্ষক", "Teachers"],
  ["accountant", "হিসাবরক্ষক", "Accountants"],
] as const;

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
  /**
   * Which keys this operator actually touched (audit M-3).
   *
   * Only these are sent. The RPC merges, so an operator who changes the
   * currency no longer re-writes the fourteen values they merely looked at —
   * which is what let one admin silently erase another's whole configuration.
   */
  const [changed, setChanged] = useState<Set<string>>(new Set());
  /** The `updated_at` this screen loaded, and the baseline the RPC checks. */
  const [baseline, setBaseline] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [confirmEduSathiOff, setConfirmEduSathiOff] = useState(false);

  useEffect(() => {
    if (!config.data) return;
    setForm({ ...config.data.value });
    setBaseline(config.data.updatedAt);
  }, [config.data]);

  const set = (k: string, v: Json) => {
    setForm((p) => ({ ...p, [k]: v }));
    setChanged((p) => (p.has(k) ? p : new Set(p).add(k)));
    setDirty(true);
  };

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

    /*
     * The one rule `NUMERIC_RULES` cannot express (audit S-1.10).
     *
     * `working_days` and `weekend` are two independent selects over the same
     * seven days and nothing checked that they agree, so a Sun–Thu working week
     * with a Sat–Sun weekend was accepted and Sunday became simultaneously a
     * teaching day and a holiday. Attendance reads one half of that
     * contradiction and the calendar reads the other.
     */
    const clash = weekendConflict(form.working_days, form.weekend);
    if (clash.length > 0) {
      const names = clash.map((d) => t(DAYS[d][1], DAYS[d][2])).join(", ");
      out.weekend = t(
        `${names} একই সাথে কার্যদিবস ও ছুটি হিসেবে ধরা হচ্ছে`,
        `${names} would be both a working day and a weekend`,
      );
    }
    return out;
  }, [form, t]);

  /** `error` + `touch` in one spread — see the note on `Field`'s `onBlur`. */
  const bind = (k: string) => ({
    error: touched.has(k) ? errors[k] : undefined,
    onBlur: () => setTouched((p) => (p.has(k) ? p : new Set(p).add(k))),
  });

  const edusathiOn = Boolean(form.edusathi_ai_assistant);
  const edusathiRoles = Array.isArray(form.edusathi_roles) ? (form.edusathi_roles as string[]) : [];

  /** Just the touched keys — see `changed`. */
  const patch = useMemo(() => {
    const out: RpcPayload = {};
    for (const k of changed) out[k] = form[k] as Json;
    return out;
  }, [changed, form]);

  /**
   * `force` skips the baseline check. It is only ever reached from the conflict
   * dialog's explicit "overwrite" — and even then it overwrites at most the
   * keys this operator changed, because the write merges.
   */
  function submit(force: boolean) {
    save.mutate(
      { value: patch, expectedUpdatedAt: force ? undefined : baseline },
      {
        onSuccess: (updatedAt) => {
          toast({ title: t("সংরক্ষিত হয়েছে", "Saved"), variant: "success" });
          setBaseline(updatedAt);
          setDirty(false);
          setTouched(new Set());
          setChanged(new Set());
          setConflict(false);
        },
        onError: (e: unknown) => {
          if (classifyError(e) === "conflict") { setConflict(true); return; }
          toast({ title: msg(e, { bn: "সংরক্ষণ ব্যর্থ", en: "Save failed" }), variant: "error" });
        },
      },
    );
  }

  /** Screen order, so "the first invalid field" means the first one you see. */
  const VALIDATED_KEYS = ["academic_year", "daily_periods", "period_duration", "weekend", "pass_mark"];

  function onSave() {
    if (Object.keys(errors).length > 0) {
      setTouched(new Set(VALIDATED_KEYS));
      toast({ title: t("চিহ্নিত ফিল্ডগুলো ঠিক করুন", "Fix the highlighted fields"), variant: "error" });
      // Land the operator on the problem rather than leaving them on the Save
      // button with a toast and no route to it (audit A-4 / WCAG 3.3.1).
      const first = VALIDATED_KEYS.find((k) => errors[k]);
      if (first) document.getElementById(`f-${first}`)?.focus();
      return;
    }
    submit(false);
  }
  function onReset() {
    setForm({ ...(config.data?.value ?? {}) });
    setDirty(false);
    setTouched(new Set());
    setChanged(new Set());
  }

  return (
    <div className="flex flex-col gap-5 pb-6">
      {/* S-1.4: this and StartUp were the only two screens in the module with a
          raw <header> and no breadcrumbs. */}
      <PageHeader
        crumbs={[{ label: t("সেটিংস", "Settings"), href: "/admin/core" }, { label: t("প্রতিষ্ঠান সেটিংস", "Institution Settings") }, { label: t("বেসিক কনফিগারেশন", "Basic Configuration") }]}
        title={t("বেসিক কনফিগারেশন", "Basic Configuration")}
        subtitle={t("একাডেমিক, ভাষা ও ডিফল্ট নীতিমালা", "Academic, language & default policies")}
      />

      {config.isLoading ? (
        <div className="flex flex-col gap-3 rounded-2xl bg-surface p-6 shadow-e1">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-11" />)}</div>
      ) : (
        <>
          <FormCard title={t("একাডেমিক সেটিংস", "Academic Settings")}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label={t("চলতি শিক্ষাবর্ষ", "Current academic year")} {...bind("academic_year")}>
                <Input type="number" value={String(form.academic_year ?? "")} id="f-academic_year" onChange={(e) => set("academic_year", e.target.value)} className="font-latin" />
              </Field>
              <Field label={t("সেশন শুরুর মাস", "Session start month")}>
                <Select value={String(form.session_start_month ?? "")} placeholder={t("নির্বাচন করুন", "Select")} options={opts(MONTHS, isBn)} onChange={(e) => set("session_start_month", e.target.value)} />
              </Field>
              <Field label={t("সপ্তাহ শুরু", "Week start day")}>
                <Select value={String(form.week_start_day ?? "")} placeholder={t("নির্বাচন করুন", "Select")} options={opts(DAYS, isBn)} onChange={(e) => set("week_start_day", e.target.value)} />
              </Field>
              {/* S-1.10: `working_days` and `weekend` constrain each other, and
                  they used to sit in different cards — so the contradiction was
                  never on screen at the same time as its cause. */}
              <Field label={t("কার্যদিবস", "Working days")} {...bind("weekend")}>
                <Select id="f-working_days" value={String(form.working_days ?? "")} placeholder={t("নির্বাচন করুন", "Select")} options={opts(WORKING_DAYS, isBn)} onChange={(e) => set("working_days", e.target.value)} />
              </Field>
              <Field label={t("সপ্তাহান্ত", "Weekend")} {...bind("weekend")}>
                <Select id="f-weekend" value={String(form.weekend ?? "")} placeholder={t("নির্বাচন করুন", "Select")} options={opts(WEEKENDS, isBn)} onChange={(e) => set("weekend", e.target.value)} />
              </Field>
              <Field label={t("দৈনিক পিরিয়ড সংখ্যা", "Daily periods")} {...bind("daily_periods")}>
                <Input type="number" min={1} value={String(form.daily_periods ?? "")} id="f-daily_periods" onChange={(e) => set("daily_periods", e.target.value)} className="font-latin" />
              </Field>
              <Field label={t("পিরিয়ড সময়কাল (মিনিট)", "Period duration (minutes)")} {...bind("period_duration")}>
                <Input type="number" min={1} value={String(form.period_duration ?? "")} id="f-period_duration" onChange={(e) => set("period_duration", e.target.value)} className="font-latin" />
              </Field>
            </div>
          </FormCard>

          {/*
            This card used to hold six controls. Three of them — Timezone,
            Currency and Date format — were read by nothing in the product:
            `৳` is written literally at fifteen call sites, `formatDate` in
            `shared/lib/format.ts` hard-codes `31 Jul 2026`, and the timezone
            was a DISABLED input showing a constant. An operator could set
            "MM/DD/YYYY" and "$ Dollar", save, get a green toast, and nothing
            anywhere would change. A control that lies about what it does costs
            more than a missing one: it produces a support ticket the second
            time someone notices, and it is the reason nobody trusts the rest of
            the screen. They are gone; the stored keys are dropped by migration
            20260808150000. If EduFusionBD ever sells outside UTC+6 or outside
            Bangladesh, wire the setting through `format.ts` FIRST and bring the
            control back after — see the ponytail note at the top of that file.
          */}
          <FormCard title={t("ভাষা ও প্রদর্শন", "Language & Display")}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t("ডিফল্ট ভাষা", "Default language")} hint={t("নতুন ব্যবহারকারী যে ভাষায় শুরু করবেন", "The language a new user starts in")}>
                <Select value={String(form.default_language ?? "")} placeholder={t("নির্বাচন করুন", "Select")} options={opts(LANGUAGES, isBn)} onChange={(e) => set("default_language", e.target.value)} />
              </Field>
              <Field label={t("সংখ্যা পদ্ধতি", "Number system")} hint={t("রোল, নম্বর ও টাকার অঙ্ক কোন সংখ্যায় ছাপা হবে", "Which numerals roll numbers, marks and amounts print in")}>
                <Select value={String(form.number_system ?? "")} placeholder={t("নির্বাচন করুন", "Select")} options={opts(NUMBER_SYSTEMS, isBn)} onChange={(e) => set("number_system", e.target.value)} />
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
                  <Input type="number" min={0} max={100} value={String(form.pass_mark ?? "")} id="f-pass_mark" onChange={(e) => set("pass_mark", e.target.value)} className="font-latin" />
                </Field>
                <Field label={t("উপস্থিতির ধরন", "Attendance type")}>
                  <Select value={String(form.attendance_type ?? "")} placeholder={t("নির্বাচন করুন", "Select")} options={opts(ATTENDANCE_TYPES, isBn)} onChange={(e) => set("attendance_type", e.target.value)} />
                </Field>
              </div>

              {/* A-1: four `<button>`s styled as switches, none of which
                  announced its state — "Parent SMS notifications, button",
                  identically on and off. */}
              <div className="flex flex-col gap-1">
                {TOGGLES.map((tg, i) => (
                  <Switch
                    key={tg.key}
                    checked={Boolean(form[tg.key])}
                    onChange={(next) => set(tg.key, next)}
                    label={t(tg.bn, tg.en)}
                    description={t(tg.sub_bn, tg.sub_en)}
                    className={i > 0 ? "border-t border-border-default py-2" : "py-1"}
                  />
                ))}
              </div>
            </div>
          </FormCard>

          {/*
            S-1.7. EduSathi is what the product is sold on, and switching it off
            for the whole institution was one checkbox in a row of four, with no
            confirmation and no statement of who it affects. A kill switch for
            the headline feature should not be easier to hit by accident than
            deleting a subject.
          */}
          <FormCard title={t("EduSathi AI সহকারী", "EduSathi AI assistant")}>
            <Switch
              checked={edusathiOn}
              onChange={(next) => {
                // Turning it OFF asks; turning it back on does not. Confirming
                // an enable is friction with nothing behind it.
                if (!next) { setConfirmEduSathiOff(true); return; }
                set("edusathi_ai_assistant", true);
              }}
              label={t("প্রতিষ্ঠানে সক্রিয়", "Enabled for this institution")}
              description={t(
                "স্টাফ যেকোনো স্ক্রিন থেকে প্রশ্ন করতে পারবেন — উপস্থিতি, ফলাফল, ফি ও রুটিন নিয়ে।",
                "Staff can ask questions from any screen — attendance, results, fees and routines.",
              )}
            />

            <div className="flex flex-col gap-2 border-t border-border-default pt-3.5">
              <span id="edusathi-roles-label" className="text-meta font-medium text-text-secondary">
                {t("কারা ব্যবহার করতে পারবেন", "Who can use it")}
              </span>
              <div role="group" aria-labelledby="edusathi-roles-label" className="flex flex-wrap gap-2">
                {EDUSATHI_ROLES.map(([value, bn, en]) => {
                  const on = edusathiRoles.includes(value);
                  return (
                    <button
                      key={value}
                      type="button"
                      disabled={!edusathiOn}
                      aria-pressed={on}
                      onClick={() =>
                        set(
                          "edusathi_roles",
                          on ? edusathiRoles.filter((r) => r !== value) : [...edusathiRoles, value],
                        )
                      }
                      className={
                        on
                          ? "rounded-full border border-primary bg-primary-subtle px-3 py-1.5 text-meta font-medium text-primary disabled:opacity-50"
                          : "rounded-full border border-border-default px-3 py-1.5 text-meta text-text-secondary hover:border-border-strong disabled:opacity-50"
                      }
                    >
                      {t(bn, en)}
                    </button>
                  );
                })}
              </div>
              <p className="text-micro text-text-muted">
                {t(
                  "কেউ নির্বাচিত না থাকলে সব স্টাফ ব্যবহার করতে পারবেন।",
                  "With nobody selected, every staff role can use it.",
                )}
              </p>
            </div>
          </FormCard>

          <SaveBar status={dirty ? <><UnsavedDot /> {t("অসংরক্ষিত পরিবর্তন", "Unsaved changes")}</> : null}>
            <Button variant="secondary" onClick={onReset} disabled={!dirty}>{t("রিসেট", "Reset")}</Button>
            <Button variant="primary" onClick={onSave} disabled={save.isPending || !dirty}>{save.isPending ? t("সংরক্ষণ হচ্ছে…", "Saving…") : t("সংরক্ষণ করুন", "Save")}</Button>
          </SaveBar>

          {/*
            Audit M-3. The write merges, so "overwrite" here replaces only the
            keys this operator changed — it cannot undo the other person's
            unrelated edits. That is what makes offering the choice safe rather
            than reckless.
          */}
          <ConfirmDialog
            open={conflict}
            onClose={() => setConflict(false)}
            onConfirm={() => submit(true)}
            tone="danger"
            title={t("অন্য কেউ এই সেটিংস পরিবর্তন করেছেন", "Someone else changed these settings")}
            description={t(
              "আপনি পাতাটি খোলার পর অন্য একজন এখানে পরিবর্তন করেছেন। রিলোড করলে তাদের পরিবর্তন দেখতে পাবেন এবং আপনার পরিবর্তন আবার করতে হবে। এগিয়ে গেলে শুধু আপনি যে ঘরগুলো বদলেছেন সেগুলোই লেখা হবে — বাকি সেটিংস অক্ষত থাকবে।",
              "Another person changed something here after you opened the page. Reloading shows you their version and you re-apply yours. Continuing writes only the fields you changed — the rest of their settings stay as they are.",
            )}
            confirmLabel={t("আমার পরিবর্তন রাখুন", "Keep my changes")}
            cancelLabel={t("রিলোড করুন", "Reload")}
            loading={save.isPending}
          />

          <ConfirmDialog
            open={confirmEduSathiOff}
            onClose={() => setConfirmEduSathiOff(false)}
            onConfirm={() => { set("edusathi_ai_assistant", false); setConfirmEduSathiOff(false); }}
            tone="danger"
            title={t("EduSathi বন্ধ করবেন?", "Turn EduSathi off?")}
            description={t(
              "প্রতিষ্ঠানের সব স্টাফের জন্য AI সহকারী বন্ধ হয়ে যাবে — কোনো স্ক্রিনে আর প্রশ্ন করা যাবে না। যেকোনো সময় আবার চালু করা যাবে।",
              "The assistant stops for every member of staff in the institution — no screen will offer it. You can switch it back on at any time.",
            )}
            confirmLabel={t("বন্ধ করুন", "Turn off")}
            cancelLabel={t("বাতিল", "Cancel")}
          />
        </>
      )}
    </div>
  );
}
