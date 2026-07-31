"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, RotateCcw, CheckCheck, Users, AlertTriangle, History, MessageSquare } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { Button, Field, Select, Input, SaveBar, Skeleton, EmptyState, ErrorState, useToast } from "@/shared/ui";
import { useClassSectionsLookup } from "@/shared/services/lookups/hooks";
import { useSectionStudents } from "@/shared/services/roster/hooks";
import type { Option } from "@/shared/services/lookups/api";
import { StatusPill, SummaryDot, Toggle, type AttTone } from "./parts";
import { useExams, useSectionAttendance, useMarkAttendance } from "../logic/hooks";
import { useErrorMessage } from "@/shared/services/errors";
import { localDay, formatDateTime } from "@/shared/lib/format";
import { useDraft } from "@/shared/lib/useDraft";
import { useUnsavedGuard } from "@/shared/lib/useUnsavedGuard";
import { smsCost } from "@/shared/lib/sms";
import { useSmsAccount } from "@/features/admin/sms-notice/logic/hooks";

// Institution-time day. Attendance taken at 19:00 local belongs to *today*, and
// `toISOString()` would file it under yesterday for a UTC+6 audience.
const iso = (d: Date) => localDay(d);

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
    const ex = existing.data?.statuses ?? {};
    setStatuses(Object.fromEntries(rows.map((r) => [r.studentId, ex[r.studentId] ?? "present"])));
  }, [students.data, existing.data]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Attendance for this (section, date[, exam]) already exists (SRA A-4 item 2).
   * Hydration used to be silent, so the operator could not tell a first entry
   * from an overwrite — on a Save that texts guardians and spends balance.
   */
  const alreadyTaken = (existing.data?.count ?? 0) > 0;

  // Autosave, same reasoning as Marks Entry: this is the highest-frequency
  // operation in the product and it runs on the flakiest connections.
  const draftKey = sectionId && date ? `attendance:${context}:${sectionId}:${date}:${examId || "-"}` : null;
  const draft = useDraft(draftKey, statuses, rows.length > 0);
  useUnsavedGuard(rows.length > 0);

  const setOne = (id: string, v: string) => setStatuses((p) => ({ ...p, [id]: v }));
  const markAll = (v: string) => setStatuses(Object.fromEntries(rows.map((r) => [r.studentId, v])));

  const summary = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of Object.values(statuses)) c[s] = (c[s] ?? 0) + 1;
    return c;
  }, [statuses]);

  const canSave = Boolean(sectionId && date && (!isExam || examId) && rows.length) && !mark.isPending;

  /**
   * What the SMS toggle will actually cost, before it is switched on (SRA A-4
   * item 5). It sat beside a Save button with no preview of the message, the
   * recipient count or the spend.
   */
  const account = useSmsAccount();
  const absentees = useMemo(
    () => Object.values(statuses).filter((v) => v === "absent" || v === "exam_absent").length,
    [statuses],
  );
  // The message the RPC composes. Bangla, so UCS-2 — the encoding that costs
  // 70 characters a segment, not 160.
  const smsPreview = t(
    `প্রিয় অভিভাবক, আপনার সন্তান ${date} তারিখে বিদ্যালয়ে অনুপস্থিত ছিল।`,
    `Dear guardian, your child was absent from school on ${date}.`,
  );
  const smsSegments = smsCost(smsPreview).segments;
  const smsUnits = sms ? smsSegments * absentees : 0;

  function save() {
    if (isExam && !examId) { toast({ title: t("পরীক্ষা নির্বাচন করুন", "Select an exam"), variant: "error" }); return; }
    if (!canSave) return;
    mark.mutate(
      { class_section_id: sectionId, att_date: date, context, exam_id: isExam ? examId : undefined, sms, entries: rows.map((r) => ({ student_id: r.studentId, status: statuses[r.studentId] ?? "present" })) },
      {
        onSuccess: (count) => {
          draft.clear();
          toast({ title: t(`${count} জনের উপস্থিতি সংরক্ষিত হয়েছে`, `Attendance saved for ${count}`), variant: "success" });
        },
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
        {/* No Search button: the roster loads reactively from the selects above.
            A control that cannot be actioned in this release is not rendered. */}
      </div>

      {alreadyTaken ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-warning-fg/30 bg-warning-bg px-4 py-3 text-meta text-warning-fg">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <p>
            {t(
              `এই তারিখের উপস্থিতি ইতিমধ্যে নেওয়া হয়েছে${existing.data?.takenBy ? ` — ${existing.data.takenBy}` : ""}${existing.data?.takenAt ? `, ${formatDateTime(existing.data.takenAt)}` : ""}। সংরক্ষণ করলে তা পরিবর্তিত হবে এবং SMS আবার যাবে।`,
              `Attendance for this date was already recorded${existing.data?.takenBy ? ` by ${existing.data.takenBy}` : ""}${existing.data?.takenAt ? ` at ${formatDateTime(existing.data.takenAt)}` : ""}. Saving overwrites it, and SMS goes out again.`,
            )}
          </p>
        </div>
      ) : null}

      {draft.pending ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-info-fg/30 bg-info-bg px-4 py-3 text-meta text-info-fg">
          <History size={16} className="shrink-0" />
          <span className="flex-1">
            {t(
              `${formatDateTime(draft.savedAt)} এ অসংরক্ষিত উপস্থিতি পাওয়া গেছে।`,
              `Unsaved attendance found from ${formatDateTime(draft.savedAt)}.`,
            )}
          </span>
          <Button variant="secondary" className="h-8 px-3" onClick={() => { const d = draft.accept(); if (d) setStatuses(d); }}>
            {t("ফিরিয়ে আনুন", "Restore")}
          </Button>
          <Button variant="ghost" className="h-8 px-3" onClick={() => draft.discard()}>
            {t("বাদ দিন", "Discard")}
          </Button>
        </div>
      ) : null}

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

      {/*
        The bill, before it is incurred (SRA A-4 item 5). The toggle sat beside
        Save with no preview of the message, the recipient count or the spend —
        and Bangla is UCS-2, so an ordinary sentence is more than one segment.
      */}
      {sms && absentees > 0 ? (
        <div className="flex flex-col gap-1.5 rounded-xl border border-info-fg/30 bg-info-bg px-4 py-3 text-meta text-info-fg">
          <div className="flex items-start gap-2.5">
            <MessageSquare size={16} className="mt-0.5 shrink-0" />
            <p className="flex-1">
              {t(
                `${n(absentees)} জন অনুপস্থিতের অভিভাবককে SMS যাবে · ${n(smsSegments)} সেগমেন্ট × ${n(absentees)} = ${n(smsUnits)} টি এসএমএস · ব্যালেন্স ${n(account.data?.balance ?? 0)}`,
                `SMS to ${absentees} absentees' guardians · ${smsSegments} segments × ${absentees} = ${smsUnits} messages · balance ${account.data?.balance ?? 0}`,
              )}
            </p>
          </div>
          <p className="pl-6.5 italic opacity-80">&ldquo;{smsPreview}&rdquo;</p>
        </div>
      ) : null}

      <SaveBar
        status={
          <div className="flex flex-wrap items-center gap-3 text-meta text-text-secondary">
            <span className="font-semibold text-text-primary">{t("সারসংক্ষেপ", "Summary")}</span>
            {STATUSES.map((s) => <SummaryDot key={s.value} color={s.dot} label={`${t(s.bn, s.en)} ${n(summary[s.value] ?? 0)}`} />)}
          </div>
        }
      >
        {/*
          Was `<button>` inside `<label>` — invalid nesting that breaks
          label-click semantics and gives screen readers unpredictable output
          (SRA A-0.7). `role="switch"` + `aria-checked` is the correct pattern.
        */}
        <button
          type="button"
          role="switch"
          aria-checked={sms}
          onClick={() => setSms((v) => !v)}
          className="mr-1 flex items-center gap-2 rounded-md px-1 py-0.5 text-meta text-text-secondary"
        >
          {t("অনুপস্থিতদের অভিভাবককে SMS", "SMS to absentees' guardians")}
          <Toggle on={sms} />
        </button>
        <Button variant="secondary" onClick={() => markAll("present")} disabled={mark.isPending}><RotateCcw size={15} /> {t("রিসেট", "Reset")}</Button>
        <Button variant="primary" onClick={save} disabled={!canSave}><Check size={16} /> {mark.isPending ? t("সংরক্ষণ হচ্ছে…", "Saving…") : t("সংরক্ষণ করুন", "Save")}</Button>
      </SaveBar>
    </div>
  );
}
