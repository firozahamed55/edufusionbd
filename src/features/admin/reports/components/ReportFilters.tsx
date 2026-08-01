"use client";

import { RotateCcw } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import { Field, Input, Select } from "@/shared/ui";
import { GENDER, RELIGION } from "@/shared/constants/enums";
import { useClasses, useClassSectionsLookup } from "@/shared/services/lookups/hooks";
import { useShifts } from "../logic/hooks";
import type { EnrolmentFilters } from "../logic/api";

/**
 * The enrolment report's filter bar (R-5).
 *
 * WHAT THIS CLOSES. `useStudentReport()` was called with no arguments, so the
 * one report in the product returned the whole institution, always — a user
 * could not ask "girls in Class Five". The Teacher Directory has implemented
 * filter → URL → paginate → export since Phase 2; Reports implemented none of
 * it, which is the gap the requirements doc rates P0.
 *
 * State lives in the URL (`useQueryState` at the screen), not here. A report is
 * a thing people send each other — "look at Class Eight's numbers" has to be a
 * link, and a filtered view that cannot be addressed cannot be cited in the
 * printed return either.
 */
export function ReportFilters({
  value,
  onChange,
  onReset,
}: {
  value: EnrolmentFilters;
  onChange: (patch: Partial<EnrolmentFilters>) => void;
  onReset: () => void;
}) {
  const { t, isBn } = useT();
  const classes = useClasses();
  const sections = useClassSectionsLookup();
  const shifts = useShifts();

  const opt = (rows: { value: string; label_bn: string; label_en: string }[] | undefined, allLabel: string) => [
    { value: "", label: allLabel },
    ...(rows ?? []).map((r) => ({ value: r.value, label: isBn ? r.label_bn : r.label_en })),
  ];
  const enumOpt = (rows: { value: string; bn: string; en: string }[], allLabel: string) => [
    { value: "", label: allLabel },
    ...rows.map((r) => ({ value: r.value, label: isBn ? r.bn : r.en })),
  ];

  const isFiltered = Object.values(value).some((v) => v);

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-surface p-5 shadow-e1" data-print="hide">
      <Field label={t("শ্রেণি", "Class")} className="w-44">
        <Select
          value={value.class_id ?? ""}
          options={opt(classes.data, t("সব শ্রেণি", "All classes"))}
          onChange={(e) => onChange({ class_id: e.target.value })}
        />
      </Field>
      <Field label={t("শাখা", "Section")} className="w-52">
        <Select
          value={value.class_section_id ?? ""}
          options={opt(sections.data, t("সব শাখা", "All sections"))}
          onChange={(e) => onChange({ class_section_id: e.target.value })}
        />
      </Field>
      {/* Shift only appears when the school actually runs more than one. A
          permanently disabled "All shifts" control is a decoration that costs a
          tab stop on every visit. */}
      {(shifts.data?.length ?? 0) > 1 ? (
        <Field label={t("শিফট", "Shift")} className="w-40">
          <Select
            value={value.shift_id ?? ""}
            options={opt(shifts.data, t("সব শিফট", "All shifts"))}
            onChange={(e) => onChange({ shift_id: e.target.value })}
          />
        </Field>
      ) : null}
      <Field label={t("লিঙ্গ", "Gender")} className="w-36">
        <Select
          value={value.gender ?? ""}
          options={enumOpt(GENDER, t("সব", "All"))}
          onChange={(e) => onChange({ gender: e.target.value })}
        />
      </Field>
      <Field label={t("ধর্ম", "Religion")} className="w-40">
        <Select
          value={value.religion ?? ""}
          options={enumOpt(RELIGION, t("সব", "All"))}
          onChange={(e) => onChange({ religion: e.target.value })}
        />
      </Field>
      <Field label={t("ভর্তির তারিখ (থেকে)", "Admitted from")} className="w-44">
        <Input
          type="date"
          value={value.admitted_from ?? ""}
          max={value.admitted_to || undefined}
          onChange={(e) => onChange({ admitted_from: e.target.value })}
        />
      </Field>
      <Field label={t("ভর্তির তারিখ (পর্যন্ত)", "Admitted to")} className="w-44">
        <Input
          type="date"
          value={value.admitted_to ?? ""}
          min={value.admitted_from || undefined}
          onChange={(e) => onChange({ admitted_to: e.target.value })}
        />
      </Field>
      {isFiltered ? (
        <button
          type="button"
          onClick={onReset}
          className="inline-flex h-10.5 items-center gap-2 rounded-lg border border-border-strong bg-surface px-4 text-meta font-semibold text-text-secondary hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          <RotateCcw size={15} /> {t("রিসেট", "Reset")}
        </button>
      ) : null}
    </div>
  );
}
