"use client";

import { useMemo, useState } from "react";
import { Search, ArrowUp, Users } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { Button, Field, Select, SaveBar, UnsavedDot, Checkbox, Skeleton, EmptyState, ErrorState, useToast } from "@/shared/ui";
import { useClassSectionsLookup, useAcademicYears } from "@/shared/services/lookups/hooks";
import type { Option } from "@/shared/services/lookups/api";
import { useSectionStudents, useRunMigration } from "../logic/hooks";
import type { RunMigrationPayload } from "../logic/api";
import { useErrorMessage } from "@/shared/services/errors";

/**
 * Shared migration runner for both "with merit" and "no-merit" flows — the two
 * screens are the same operation differing only in `type` (merit_rank ordering).
 * Live: source section → students from Supabase → select → fn_run_migration
 * (transaction-safe promotion into the target section).
 */
export function MigrationRunner({ type }: { type: "merit" | "no_merit" }) {
  const isMerit = type === "merit";
  const { t, n, isBn } = useT();
  const msg = useErrorMessage();
  const toast = useToast();

  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const sections = useClassSectionsLookup();
  const years = useAcademicYears();
  const students = useSectionStudents(sourceId || null);
  const run = useRunMigration();

  const opt = (list?: Option[]) => (list ?? []).map((o) => ({ value: o.value, label: isBn ? o.label_bn : o.label_en }));
  const rows = students.data ?? [];

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const someSelected = selected.size > 0 && !allSelected;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.enrollmentId)));
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const yearId = useMemo(() => years.data?.[0]?.value ?? "", [years.data]);
  const canRun = Boolean(sourceId && targetId && sourceId !== targetId && selected.size > 0 && yearId) && !run.isPending;

  function submit() {
    if (sourceId === targetId) { toast({ title: t("উৎস ও লক্ষ্য শাখা ভিন্ন হতে হবে", "Source and target must differ"), variant: "error" }); return; }
    if (!canRun) { toast({ title: t("শাখা ও শিক্ষার্থী নির্বাচন করুন", "Select sections and students"), variant: "error" }); return; }
    const chosen = rows.filter((r) => selected.has(r.enrollmentId));
    const payload: RunMigrationPayload = {
      academic_year_id: yearId,
      source_class_section_id: sourceId,
      target_class_section_id: targetId,
      type,
      students: chosen.map((r, idx) => ({
        student_id: r.studentId,
        source_enrollment_id: r.enrollmentId,
        merit_rank: isMerit ? idx + 1 : undefined,
        result: "pass",
      })),
    };
    run.mutate(payload, {
      onSuccess: () => {
        toast({ title: t(`${chosen.length} জন শিক্ষার্থী উন্নীত হয়েছে`, `${chosen.length} students promoted`), variant: "success" });
        setSelected(new Set());
      },
      onError: (e: unknown) => toast({ title: msg(e, { bn: "মাইগ্রেশন ব্যর্থ", en: "Migration failed" }), variant: "error" }),
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="mt-1.5 text-h4 font-bold text-text-primary">{isMerit ? t("মাইগ্রেশন — মেধাক্রমসহ", "Migration — With Merit") : t("মাইগ্রেশন — মেধাক্রম ছাড়া", "Migration — Without Merit")}</h1>
        <p className="mt-1 text-meta text-text-muted">{t("শিক্ষার্থীদের পরবর্তী শ্রেণিতে উন্নীত করুন", "Promote students to the next class")}</p>
      </header>

      <div className="grid grid-cols-1 gap-3 rounded-2xl bg-surface p-5 shadow-e3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label={t("উৎস শ্রেণি ও শাখা", "Source Class & Section")} required>
          <Select value={sourceId} placeholder={sections.isLoading ? t("লোড হচ্ছে…", "Loading…") : t("নির্বাচন করুন", "Select")} options={opt(sections.data)}
            onChange={(e) => { setSourceId(e.target.value); setSelected(new Set()); }} />
        </Field>
        <Field label={t("লক্ষ্য শ্রেণি ও শাখা", "Target Class & Section")} required>
          <Select value={targetId} placeholder={t("নির্বাচন করুন", "Select")} options={opt(sections.data)} onChange={(e) => setTargetId(e.target.value)} />
        </Field>
        <Button variant="primary" className="h-10.5 px-6" disabled>
          <Search size={16} /> {t("অনুসন্ধান", "Search")}
        </Button>
      </div>

      {!sourceId ? (
        <EmptyState icon={<Users size={22} />} title={t("উৎস শাখা নির্বাচন করুন", "Select a source section")} description={t("উন্নীত করার জন্য শিক্ষার্থী তালিকা লোড করুন।", "Load the student list to promote them.")} />
      ) : students.isLoading ? (
        <div className="flex flex-col gap-2 rounded-2xl bg-surface p-5 shadow-e3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-11" />)}</div>
      ) : students.isError ? (
        <ErrorState title={t("তালিকা লোড করা যায়নি", "Could not load list")} description={msg(students.error)} />
      ) : rows.length === 0 ? (
        <EmptyState icon={<Users size={22} />} title={t("এই শাখায় কোনো শিক্ষার্থী নেই", "No students in this section")} />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-surface shadow-e3">
          <div className="flex items-center gap-3 border-b border-border-default px-5 py-4">
            <p className="flex-1 text-base font-semibold text-text-primary">{t("শিক্ষার্থী তালিকা", "Student List")}</p>
            {selected.size > 0 ? <span className="text-meta font-semibold text-text-secondary">{n(selected.size)} {t("নির্বাচিত", "selected")}</span> : null}
            <span className="text-meta font-semibold text-primary">{t("মোট পাওয়া গেছে", "Total found")}: {n(rows.length)}</span>
          </div>
          <div className="flex items-center gap-3 px-5 pt-4 pb-2 text-meta font-semibold text-text-muted">
            <div className="flex w-10 items-center">
              <Checkbox checked={allSelected} ref={(el) => { if (el) el.indeterminate = someSelected; }} onChange={toggleAll} aria-label={t("সব নির্বাচন করুন", "Select all")} />
            </div>
            <div className="w-37.5">{t("শিক্ষার্থী আইডি", "Student ID")}</div>
            <div className="w-20">{t("রোল", "Roll")}</div>
            <div className="flex-1">{t("নাম", "Name")}</div>
            {isMerit ? <div className="w-24">{t("মেধাক্রম", "Merit")}</div> : null}
            <div className="w-17.5 text-right">{t("অ্যাকশন", "Action")}</div>
          </div>
          {rows.map((r, i) => {
            const checked = selected.has(r.enrollmentId);
            return (
              <div key={r.enrollmentId} className={cn("flex items-center gap-3 border-b border-border-default px-5 py-3.5 last:border-0", checked ? "bg-primary-subtle" : i % 2 === 1 && "bg-sunken")}>
                <div className="flex w-10 items-center">
                  <Checkbox checked={checked} onChange={() => toggleOne(r.enrollmentId)} aria-label={t(`নির্বাচন করুন ${r.name_en}`, `Select ${r.name_en}`)} />
                </div>
                <div className="w-37.5 font-latin text-meta font-medium text-text-secondary tnum">{r.code ? n(r.code) : "—"}</div>
                <div className="w-20 text-meta text-text-secondary tnum">{r.roll != null ? n(r.roll) : "—"}</div>
                <div className="flex-1 text-sm font-medium text-text-primary">{isBn ? r.name_bn : r.name_en}</div>
                {isMerit ? <div className="w-24 text-meta font-semibold text-text-primary tnum">{n(i + 1)}</div> : null}
                <div className="flex w-17.5 justify-end">
                  <button aria-label={t("উন্নীত করুন", "Promote")} onClick={() => { setSelected(new Set([r.enrollmentId])); }}
                    className="grid size-8 place-items-center rounded-lg bg-primary text-text-on-primary hover:bg-primary-hover">
                    <ArrowUp size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <SaveBar
        status={<><UnsavedDot /><span>{selected.size > 0 ? t(`${selected.size} জন নির্বাচিত`, `${selected.size} selected`) : t("শিক্ষার্থী নির্বাচন করুন", "Select students to promote")}</span></>}
      >
        <Button variant="secondary" onClick={() => setSelected(new Set())} disabled={run.isPending || selected.size === 0}>{t("বাতিল করুন", "Clear")}</Button>
        <Button variant="primary" onClick={submit} disabled={!canRun}>{run.isPending ? t("চলছে…", "Running…") : t("মাইগ্রেশন করুন", "Run Migration")}</Button>
      </SaveBar>
    </div>
  );
}
