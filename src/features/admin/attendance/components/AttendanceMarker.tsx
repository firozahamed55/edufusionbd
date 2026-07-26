"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Check, RotateCcw, CheckCheck, Users } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { Button, Field, Select, Input, SaveBar, Skeleton, EmptyState, ErrorState, useToast } from "@/shared/ui";
import { useClassSectionsLookup } from "@/shared/services/lookups/hooks";
import { useSectionStudents } from "@/shared/services/roster/hooks";
import type { Option } from "@/shared/services/lookups/api";
import { StatusPill, SummaryDot, Toggle, type AttTone } from "./parts";
import { useExams, useSectionAttendance, useMarkAttendance } from "../logic/hooks";
import { useErrorMessage } from "@/shared/services/errors";

const iso = (d: Date) => d.toISOString().slice(0, 10);

type StatusDef = { value: string; tone: AttTone; bn: string; en: string; dot: string };
const DAILY: StatusDef[] = [
  { value: "present", tone: "success", bn: "উপস্থিত", en: "Present", dot: "bg-success-fg" },
  { value: "absent", tone: "danger", bn: "অনুপস্থিত", en: "Absent", dot: "bg-danger-fg" },
  { value: "late", tone: "warning", bn: "দেরি", en: "Late", dot: "bg-warning-fg" },
  { value: "leave", tone: "leave", bn: "ছুটি", en: "Leave", dot: "bg-sky-600" },
];
const EXAM: StatusDef[] = [
  { value: "present", tone: "success", bn: "উপস্থিত", en: "Present", dot: "bg-success-fg" },
  { value: "absent", tone: "danger", bn: "অনুপস্থিত", en: "Absent", dot: "bg-danger-fg" },
  { value: "late", tone: "warning", bn: "দেরি", en: "Late", dot: "bg-warning-fg" },
  { value: "exam_absent", tone: "exam", bn: "পরীক্ষায় অনুপস্থিত", en: "Exam absent", dot: "bg-violet-600" },
];

/** Live attendance marker — used by Section, Exam and both Update screens. */
export function AttendanceMarker({ context }: { context: "daily" | "exam" }) {
  const isExam = context === "exam";
  const { t, n, isBn } = useT();
  const msg = useErrorMessage();
  const toast = useToast();
  const STATUSES = isExam ? EXAM : DAILY;

  const [sectionId, setSectionId] = useState("");
  const [date, setDate] = useState(iso(new Date()));
  const [examId, setExamId] = useState("");
  const [sms, setSms] = useState(true);
  const [statuses, setStatuses] = useState<Record<string, string>>({});

  const sections = useClassSectionsLookup();
  const exams = useExams();
  const students = useSectionStudents(sectionId || null);
  const existing = useSectionAttendance(sectionId || null, date, context, isExam ? examId || null : null);
  const mark = useMarkAttendance();

  const opt = (list?: Option[]) => (list ?? []).map((o) => ({ value: o.value, label: isBn ? o.label_bn : o.label_en }));
  const rows = students.data ?? [];

  // hydrate statuses from existing marks + default remaining to present
  useEffect(() => {
    if (!rows.length) return;
    const ex = existing.data ?? {};
    setStatuses(Object.fromEntries(rows.map((r) => [r.studentId, ex[r.studentId] ?? "present"])));
  }, [students.data, existing.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const setOne = (id: string, v: string) => setStatuses((p) => ({ ...p, [id]: v }));
  const markAll = (v: string) => setStatuses(Object.fromEntries(rows.map((r) => [r.studentId, v])));

  const summary = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of Object.values(statuses)) c[s] = (c[s] ?? 0) + 1;
    return c;
  }, [statuses]);

  const canSave = Boolean(sectionId && date && (!isExam || examId) && rows.length) && !mark.isPending;

  function save() {
    if (isExam && !examId) { toast({ title: t("পরীক্ষা নির্বাচন করুন", "Select an exam"), variant: "error" }); return; }
    if (!canSave) return;
    mark.mutate(
      { class_section_id: sectionId, att_date: date, context, exam_id: isExam ? examId : undefined, sms, entries: rows.map((r) => ({ student_id: r.studentId, status: statuses[r.studentId] ?? "present" })) },
      {
        onSuccess: (count) => toast({ title: t(`${count} জনের উপস্থিতি সংরক্ষিত হয়েছে`, `Attendance saved for ${count}`), variant: "success" }),
        onError: (e: unknown) => toast({ title: msg(e, { bn: "সংরক্ষণ ব্যর্থ", en: "Save failed" }), variant: "error" }),
      },
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="mt-1.5 text-h4 font-bold text-text-primary">{isExam ? t("পরীক্ষা উপস্থিতি", "Exam Attendance") : t("সেকশন উপস্থিতি", "Section Attendance")}</h1>
        <p className="mt-1 text-meta text-text-muted">{isExam ? t("নির্বাচিত পরীক্ষায় উপস্থিতি চিহ্নিত করুন", "Mark attendance for the selected exam") : t("নির্বাচিত শ্রেণির আজকের উপস্থিতি চিহ্নিত করুন", "Mark today's attendance for the selected class")}</p>
      </header>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-surface p-5 shadow-e1">
        <Field label={t("শ্রেণি ও শাখা", "Class & Section")} required className="w-65 max-w-full">
          <Select value={sectionId} placeholder={sections.isLoading ? t("লোড হচ্ছে…", "Loading…") : t("নির্বাচন করুন", "Select")} options={opt(sections.data)} onChange={(e) => setSectionId(e.target.value)} />
        </Field>
        {isExam ? (
          <Field label={t("পরীক্ষার নাম", "Exam name")} required className="w-60 max-w-full">
            <Select value={examId} placeholder={t("নির্বাচন করুন", "Select")} options={(exams.data ?? []).map((e) => ({ value: e.id, label: e.name }))} onChange={(e) => setExamId(e.target.value)} />
          </Field>
        ) : null}
        <Field label={t("তারিখ", "Date")} className="w-50 max-w-full"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Button variant="primary" className="h-10.5 px-6" disabled><Search size={16} /> {t("অনুসন্ধান", "Search")}</Button>
      </div>

      {!sectionId || (isExam && !examId) ? (
        <EmptyState icon={<Users size={22} />} title={isExam ? t("শ্রেণি ও পরীক্ষা নির্বাচন করুন", "Select class & exam") : t("একটি শ্রেণি নির্বাচন করুন", "Select a class")} />
      ) : students.isLoading ? (
        <div className="flex flex-col gap-2 rounded-2xl bg-surface p-5 shadow-e1">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-11" />)}</div>
      ) : students.isError ? (
        <ErrorState title={t("তালিকা লোড করা যায়নি", "Could not load list")} description={msg(students.error)} />
      ) : rows.length === 0 ? (
        <EmptyState icon={<Users size={22} />} title={t("এই শাখায় কোনো শিক্ষার্থী নেই", "No students in this section")} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border-default bg-surface shadow-e1">
          <div className="min-w-225">
            <div className="flex items-center gap-3 border-b border-border-default px-5 py-4">
              <p className="flex-1 text-base font-semibold text-text-primary">{t("শিক্ষার্থী তালিকা", "Student list")}</p>
              <button onClick={() => markAll("present")} className="flex items-center gap-1.5 rounded-lg border border-success-fg bg-success-bg px-3 py-2 text-meta font-semibold text-success-fg transition-colors hover:brightness-95">
                <CheckCheck size={15} /> {t("সবাইকে উপস্থিত", "All present")}
              </button>
              <span className="text-meta font-semibold text-primary">{t("মোট", "Total")}: {n(rows.length)}</span>
            </div>
            {rows.map((r, i) => (
              <div key={r.enrollmentId} className={cn("flex items-center gap-3 px-5 py-3", i % 2 === 1 && "bg-sunken")}>
                <div className="w-37.5 font-latin text-meta font-medium text-text-secondary tnum">{r.code ? n(r.code) : "—"}</div>
                <div className="w-17.5 text-meta text-text-secondary tnum">{r.roll != null ? n(r.roll) : "—"}</div>
                <div className="flex-1 text-sm font-medium text-text-primary">{isBn ? r.name_bn : r.name_en}</div>
                <div className="flex items-center gap-2">
                  {STATUSES.map((s) => (
                    <button key={s.value} type="button" onClick={() => setOne(r.studentId, s.value)} className="appearance-none border-0 bg-transparent p-0">
                      <StatusPill tone={s.tone} label={t(s.bn, s.en)} active={statuses[r.studentId] === s.value} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <SaveBar
        status={
          <div className="flex flex-wrap items-center gap-3 text-meta text-text-secondary">
            <span className="font-semibold text-text-primary">{t("সারসংক্ষেপ", "Summary")}</span>
            {STATUSES.map((s) => <SummaryDot key={s.value} color={s.dot} label={`${t(s.bn, s.en)} ${n(summary[s.value] ?? 0)}`} />)}
          </div>
        }
      >
        <label className="mr-1 flex items-center gap-2 text-meta text-text-secondary">
          {t("অনুপস্থিতদের অভিভাবককে SMS", "SMS to absentees' guardians")}
          <button type="button" onClick={() => setSms((v) => !v)}><Toggle on={sms} /></button>
        </label>
        <Button variant="secondary" onClick={() => markAll("present")} disabled={mark.isPending}><RotateCcw size={15} /> {t("রিসেট", "Reset")}</Button>
        <Button variant="primary" onClick={save} disabled={!canSave}><Check size={16} /> {mark.isPending ? t("সংরক্ষণ হচ্ছে…", "Saving…") : t("সংরক্ষণ করুন", "Save")}</Button>
      </SaveBar>
    </div>
  );
}
