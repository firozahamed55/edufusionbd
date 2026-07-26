"use client";

import { useState } from "react";
import { Cpu, Award, Download } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { Field, Select, Button, Skeleton, EmptyState, ErrorState, useToast } from "@/shared/ui";
import { useClassSectionsLookup } from "@/shared/services/lookups/hooks";
import type { Option } from "@/shared/services/lookups/api";
import { useExams, useExamResults, useProcessExam } from "../logic/hooks";
import { useErrorMessage } from "@/shared/services/errors";

const resultTone = (r: string | null) => (r === "pass" ? "bg-success-bg text-success-fg" : r === "fail" ? "bg-danger-bg text-danger-fg" : "bg-sunken text-text-secondary");

/**
 * Live exam result processing + view. `mode="process"` shows the Process button
 * (runs fn_process_exam_result); `mode="view"` is the read-only result sheet
 * with a section filter.
 */
export function ResultProcessor({ mode }: { mode: "process" | "view" }) {
  const { t, n, isBn } = useT();
  const msg = useErrorMessage();
  const toast = useToast();
  const [examId, setExamId] = useState("");
  const [sectionId, setSectionId] = useState("");

  const exams = useExams();
  const sections = useClassSectionsLookup();
  const results = useExamResults(examId || null, mode === "view" ? sectionId || null : null);
  const process = useProcessExam();
  const opt = (list?: Option[]) => (list ?? []).map((o) => ({ value: o.value, label: isBn ? o.label_bn : o.label_en }));
  const rows = results.data ?? [];

  function run() {
    if (!examId) { toast({ title: t("পরীক্ষা নির্বাচন করুন", "Select an exam"), variant: "error" }); return; }
    process.mutate(examId, {
      onSuccess: () => toast({ title: t("ফলাফল প্রক্রিয়াকরণ সম্পন্ন হয়েছে", "Results processed"), variant: "success" }),
      onError: (e: unknown) => toast({ title: msg(e, { bn: "প্রক্রিয়াকরণ ব্যর্থ", en: "Processing failed" }), variant: "error" }),
    });
  }

  const isProcess = mode === "process";
  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="mt-1.5 text-h4 font-bold text-text-primary">{isProcess ? t("ফলাফল প্রক্রিয়াকরণ", "Result Processing") : t("ফলাফল ও মার্কশিট", "Results & Mark Sheet")}</h1>
        <p className="mt-1 text-meta text-text-muted">{isProcess ? t("নম্বর থেকে GPA, গ্রেড ও মেধাক্রম গণনা করুন", "Compute GPA, grade & merit rank from marks") : t("প্রক্রিয়াকৃত ফলাফল দেখুন ও ডাউনলোড করুন", "View & download processed results")}</p>
      </header>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-surface p-5 shadow-e3">
        <Field label={t("পরীক্ষা", "Exam")} required className="w-65 max-w-full">
          <Select value={examId} placeholder={exams.isLoading ? t("লোড হচ্ছে…", "Loading…") : t("নির্বাচন", "Select")} options={(exams.data ?? []).map((e) => ({ value: e.id, label: e.name }))} onChange={(e) => setExamId(e.target.value)} />
        </Field>
        {!isProcess ? (
          <Field label={t("শাখা", "Section")} className="w-55 max-w-full">
            <Select value={sectionId} placeholder={t("সকল শাখা", "All sections")} options={[{ value: "", label: t("সকল শাখা", "All sections") }, ...opt(sections.data)]} onChange={(e) => setSectionId(e.target.value)} />
          </Field>
        ) : null}
        <div className="flex-1" />
        {isProcess ? (
          <Button variant="primary" className="h-10.5 px-6" onClick={run} disabled={!examId || process.isPending}><Cpu size={16} /> {process.isPending ? t("প্রক্রিয়াকরণ…", "Processing…") : t("ফলাফল প্রক্রিয়া করুন", "Process results")}</Button>
        ) : (
          <button disabled className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-text-on-primary opacity-60"><Download size={16} /> {t("PDF ডাউনলোড", "Download PDF")}</button>
        )}
      </div>

      {!examId ? (
        <EmptyState icon={<Award size={22} />} title={t("একটি পরীক্ষা নির্বাচন করুন", "Select an exam")} />
      ) : results.isLoading ? (
        <div className="flex flex-col gap-2 rounded-2xl bg-surface p-5 shadow-e3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-11" />)}</div>
      ) : results.isError ? (
        <ErrorState title={t("ফলাফল লোড করা যায়নি", "Could not load results")} />
      ) : rows.length === 0 ? (
        <EmptyState icon={<Award size={22} />} title={t("এখনও কোনো প্রক্রিয়াকৃত ফলাফল নেই", "No processed results yet")} description={isProcess ? t("নম্বর এন্ট্রির পর ‘ফলাফল প্রক্রিয়া করুন’ চাপুন।", "After entering marks, click Process results.") : undefined} />
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-surface shadow-e3">
          <div className="min-w-180">
            <div className="flex items-center gap-3 border-b border-border-default px-5 py-4">
              <p className="flex-1 text-base font-semibold text-text-primary">{t("ফলাফল তালিকা", "Results")}</p>
              <span className="text-meta font-semibold text-primary">{t("মোট", "Total")}: {n(rows.length)}</span>
            </div>
            <div className="flex items-center gap-3 border-b border-border-default px-5 py-3 text-meta font-semibold text-text-muted">
              <div className="w-20">{t("মেধাক্রম", "Merit")}</div>
              <div className="w-32.5">{t("আইডি", "ID")}</div>
              <div className="flex-1">{t("শিক্ষার্থী", "Student")}</div>
              <div className="w-24 text-right">{t("মোট নম্বর", "Total")}</div>
              <div className="w-20 text-center">{t("GPA", "GPA")}</div>
              <div className="w-24 text-center">{t("ফলাফল", "Result")}</div>
            </div>
            {rows.map((r, i) => (
              <div key={`${r.code}-${i}`} className={cn("flex items-center gap-3 px-5 py-3.5", i % 2 === 1 && "bg-sunken")}>
                <div className="w-20 text-meta font-bold text-primary tnum">{r.merit != null ? n(r.merit) : "—"}</div>
                <div className="w-32.5 font-latin text-meta text-text-secondary tnum">{r.code ? n(r.code) : "—"}</div>
                <div className="flex-1 text-sm font-medium text-text-primary">{isBn ? r.name_bn : r.name_en}</div>
                <div className="w-24 text-right text-meta font-semibold text-text-primary tnum">{r.total != null ? n(r.total) : "—"}</div>
                <div className="w-20 text-center text-meta font-bold text-text-primary tnum">{r.gpa != null ? n(r.gpa) : "—"}</div>
                <div className="w-24 text-center"><span className={cn("inline-block rounded-full px-2.5 py-1 text-xs font-semibold", resultTone(r.result))}>{r.result === "pass" ? t("উত্তীর্ণ", "Pass") : r.result === "fail" ? t("অকৃতকার্য", "Fail") : "—"}</span></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
