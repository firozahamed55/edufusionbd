"use client";

import { useState } from "react";
import { cn } from "@/shared/lib/cn";
import { FormCard, Field, Input, Select, useToast } from "@/shared/ui";
import { useT } from "@/shared/i18n/useT";
import { SettingsShell } from "./SettingsShell";
import { useExams, useGradeSchemes, useUpsertExam } from "../logic/hooks";

const TYPES = [
  { value: "semester", bn: "সেমিস্টার", en: "Semester" },
  { value: "term", bn: "টার্ম / সাময়িক", en: "Term" },
  { value: "model", bn: "মডেল টেস্ট", en: "Model" },
];
const STATUSES = [
  { value: "setup", bn: "সেটআপ", en: "Setup" },
  { value: "running", bn: "চলমান", en: "Running" },
  { value: "locked", bn: "লকড", en: "Locked" },
  { value: "published", bn: "প্রকাশিত", en: "Published" },
];
const EMPTY = { id: "", name: "", type: "term", grade_scheme_id: "", start_date: "", end_date: "", status: "setup" };

/** Exam-start tab — create, list and edit exams (live via fn_upsert_exam). */
export function ExamSettingsTab() {
  const { t, isBn } = useT();
  const toast = useToast();
  const exams = useExams();
  const schemes = useGradeSchemes();
  const upsert = useUpsertExam();
  const [f, setF] = useState({ ...EMPTY });
  const up = (k: keyof typeof EMPTY, v: string) => setF((p) => ({ ...p, [k]: v }));

  function onSave() {
    if (!f.name.trim()) { toast({ title: t("পরীক্ষার নাম আবশ্যক", "Exam name is required"), variant: "error" }); return; }
    upsert.mutate(f, {
      onSuccess: () => { toast({ title: f.id ? t("পরীক্ষা হালনাগাদ হয়েছে", "Exam updated") : t("পরীক্ষা তৈরি হয়েছে", "Exam created"), variant: "success" }); setF({ ...EMPTY }); },
      onError: (e: unknown) => toast({ title: e instanceof Error ? e.message : t("সংরক্ষণ ব্যর্থ", "Save failed"), variant: "error" }),
    });
  }

  return (
    <SettingsShell active="settings" onSave={onSave} onReset={() => setF({ ...EMPTY })} saving={upsert.isPending}
      statusText={f.id ? t("বিদ্যমান পরীক্ষা সম্পাদনা", "Editing existing exam") : t("নতুন পরীক্ষা", "New exam")}>
      <FormCard title={f.id ? t("পরীক্ষা সম্পাদনা", "Edit Exam") : t("নতুন পরীক্ষা তৈরি করুন", "Create New Exam")}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t("পরীক্ষার নাম", "Exam name")} required className="sm:col-span-2 lg:col-span-1"><Input value={f.name} onChange={(e) => up("name", e.target.value)} placeholder={t("অর্ধ-বার্ষিক পরীক্ষা ২০২৬", "Half-Yearly 2026")} /></Field>
          <Field label={t("ধরন", "Type")}><Select value={f.type} options={TYPES.map((x) => ({ value: x.value, label: isBn ? x.bn : x.en }))} onChange={(e) => up("type", e.target.value)} /></Field>
          <Field label={t("গ্রেডিং স্কিম", "Grade scheme")}><Select value={f.grade_scheme_id} placeholder={t("ডিফল্ট", "Default")} options={(schemes.data ?? []).map((s) => ({ value: s.id, label: s.name }))} onChange={(e) => up("grade_scheme_id", e.target.value)} /></Field>
          <Field label={t("শুরুর তারিখ", "Start date")}><Input type="date" value={f.start_date} onChange={(e) => up("start_date", e.target.value)} /></Field>
          <Field label={t("শেষ তারিখ", "End date")}><Input type="date" value={f.end_date} onChange={(e) => up("end_date", e.target.value)} /></Field>
          <Field label={t("স্ট্যাটাস", "Status")}><Select value={f.status} options={STATUSES.map((x) => ({ value: x.value, label: isBn ? x.bn : x.en }))} onChange={(e) => up("status", e.target.value)} /></Field>
        </div>
      </FormCard>

      <FormCard title={t("বিদ্যমান পরীক্ষা", "Existing Exams")}>
        {exams.isLoading ? (
          <p className="text-meta text-text-muted">{t("লোড হচ্ছে…", "Loading…")}</p>
        ) : (exams.data ?? []).length === 0 ? (
          <p className="text-meta text-text-muted">{t("এখনও কোনো পরীক্ষা নেই।", "No exams yet.")}</p>
        ) : (
          <div className="flex flex-col">
            <div className="flex items-center gap-3 border-b border-border-default pb-2 text-[12.5px] font-semibold text-text-muted">
              <div className="flex-1">{t("নাম", "Name")}</div>
              <div className="w-28">{t("ধরন", "Type")}</div>
              <div className="w-28">{t("স্ট্যাটাস", "Status")}</div>
              <div className="w-20 text-right">{t("অ্যাকশন", "Action")}</div>
            </div>
            {(exams.data ?? []).map((e, i) => (
              <div key={e.id} className={cn("flex items-center gap-3 py-2.5", i % 2 === 1 && "bg-sunken")}>
                <div className="flex-1 text-sm font-medium text-text-primary">{e.name}</div>
                <div className="w-28 text-meta text-text-secondary">{TYPES.find((x) => x.value === e.type)?.[isBn ? "bn" : "en"] ?? e.type ?? "—"}</div>
                <div className="w-28"><span className="inline-block rounded-full bg-primary-subtle px-2.5 py-1 text-xs font-semibold text-primary">{STATUSES.find((x) => x.value === e.status)?.[isBn ? "bn" : "en"] ?? e.status}</span></div>
                <div className="w-20 text-right">
                  <button onClick={() => setF({ id: e.id, name: e.name, type: e.type ?? "term", grade_scheme_id: "", start_date: e.start_date ?? "", end_date: e.end_date ?? "", status: e.status })}
                    className="text-meta font-semibold text-primary hover:underline">{t("সম্পাদনা", "Edit")}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </FormCard>
    </SettingsShell>
  );
}
