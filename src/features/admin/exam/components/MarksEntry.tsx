"use client";

import { useEffect, useMemo, useState } from "react";
import { Save, ClipboardList, Info, History } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { Field, Select, Input, Checkbox, Button, SaveBar, UnsavedDot, Skeleton, EmptyState, ErrorState, useToast } from "@/shared/ui";
import { useClassSectionsLookup, useSubjects } from "@/shared/services/lookups/hooks";
import { useSectionStudents } from "@/shared/services/roster/hooks";
import type { Option } from "@/shared/services/lookups/api";
import { useExams, useSectionClassId, useExistingMarks, useSaveMarks, useSubjectMarks, useExamConfig } from "../logic/hooks";
import { useErrorMessage } from "@/shared/services/errors";
import { useDraft } from "@/shared/lib/useDraft";
import { useUnsavedGuard } from "@/shared/lib/useUnsavedGuard";
import { formatDateTime } from "@/shared/lib/format";

/** Live mark entry/update — pick exam + section + subject, enter marks, save. */
export function MarksEntry({ mode }: { mode: "input" | "update" }) {
  const { t, n, isBn } = useT();
  const msg = useErrorMessage();
  const toast = useToast();
  const [examId, setExamId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [marks, setMarks] = useState<Record<string, { marks: string; absent: boolean }>>({});

  const exams = useExams();
  const sections = useClassSectionsLookup();
  const subjects = useSubjects();
  const students = useSectionStudents(sectionId || null);
  const classId = useSectionClassId(sectionId || null);
  const existing = useExistingMarks(examId || null, classId.data ?? null, subjectId || null);
  const subjectMarks = useSubjectMarks(subjectId || null);
  const markConfig = useExamConfig("mark");
  const save = useSaveMarks();

  /**
   * Full marks are DERIVED, never typed (SRA A-5.1 item 1).
   *
   * The field used to be a free-text input defaulting to "100", and nothing
   * consulted the subject's configured marks or `mark_config` — the screen that
   * exists to set exactly this. Entering 100 for a subject configured at 50
   * silently produced a wrong GPA for the entire section, and the marksheet
   * looked perfectly normal.
   *
   * Precedence is most-specific-first: the subject's own value, else the
   * institution-wide mark config, else 100 as a declared last resort.
   */
  const full = useMemo(() => {
    const fromSubject = subjectMarks.data?.full_marks;
    if (fromSubject != null && fromSubject > 0) return { value: fromSubject, source: "subject" as const };
    const fromConfig = Number((markConfig.data as { full_marks?: unknown } | undefined)?.full_marks ?? NaN);
    if (Number.isFinite(fromConfig) && fromConfig > 0) return { value: fromConfig, source: "config" as const };
    return { value: 100, source: "fallback" as const };
  }, [subjectMarks.data, markConfig.data]);

  const opt = (list?: Option[]) => (list ?? []).map((o) => ({ value: o.value, label: isBn ? o.label_bn : o.label_en }));
  // Memoised: `?? []` is a fresh array each render, which would make the
  // validity useMemo below recompute forever.
  const rows = useMemo(() => students.data ?? [], [students.data]);

  useEffect(() => {
    if (!rows.length) return;
    const ex = existing.data ?? {};
    setMarks(Object.fromEntries(rows.map((r) => [r.studentId, ex[r.studentId] ?? { marks: "", absent: false }])));
  }, [students.data, existing.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const ready = Boolean(examId && sectionId && subjectId);

  /**
   * Autosave (SRA A-0.6). 60 numeric inputs for one section live in React state
   * and nowhere else until Save. On the intermittent connections and shared
   * machines these schools run, a closed tab takes a 45-minute entry session
   * with it. Keyed by the work, not the screen, so switching subject and back
   * finds the right draft.
   */
  const draftKey = ready ? `marks:${examId}:${sectionId}:${subjectId}` : null;
  const entered = useMemo(
    () => Object.values(marks).filter((m) => m.absent || m.marks !== "").length,
    [marks],
  );
  const draft = useDraft(draftKey, marks, entered > 0);
  // Only warn once something is actually at stake.
  useUnsavedGuard(entered > 0);
  const setMark = (id: string, patch: Partial<{ marks: string; absent: boolean }>) => setMarks((p) => ({ ...p, [id]: { ...(p[id] ?? { marks: "", absent: false }), ...patch } }));

  /**
   * `max` on a number input is a browser hint, not a constraint — a pasted or
   * programmatically-set value above full marks was accepted and saved. This is
   * the check that actually holds, and it names how many entries are at fault
   * instead of failing with a generic toast.
   */
  const invalid = useMemo(
    () =>
      rows.filter((r) => {
        const m = marks[r.studentId];
        if (!m || m.absent || m.marks === "") return false;
        const v = Number(m.marks);
        return !Number.isFinite(v) || v < 0 || v > full.value;
      }),
    [rows, marks, full.value],
  );

  function submit() {
    if (!ready || !rows.length) { toast({ title: t("পরীক্ষা, শাখা ও বিষয় নির্বাচন করুন", "Select exam, section and subject"), variant: "error" }); return; }
    if (invalid.length > 0) {
      toast({ title: t(`${n(invalid.length)} জনের নম্বর ০–${n(full.value)} সীমার বাইরে`, `${invalid.length} entries fall outside 0–${full.value}`), variant: "error" });
      return;
    }
    save.mutate(
      { exam_id: examId, class_section_id: sectionId, subject_id: subjectId, full_marks: String(full.value),
        entries: rows.map((r) => ({ student_id: r.studentId, marks_obtained: marks[r.studentId]?.absent ? "" : (marks[r.studentId]?.marks ?? ""), is_absent: marks[r.studentId]?.absent ?? false })) },
      {
        onSuccess: (count) => {
          // The draft has done its job — keeping it would re-offer saved work.
          draft.clear();
          toast({ title: t(`${count} জনের নম্বর সংরক্ষিত হয়েছে`, `Saved marks for ${count}`), variant: "success" });
        },
        onError: (e: unknown) => toast({ title: msg(e, { bn: "সংরক্ষণ ব্যর্থ", en: "Save failed" }), variant: "error" }),
      },
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="mt-1.5 text-h4 font-bold text-text-primary">{mode === "input" ? t("মার্ক ইনপুট", "Mark Input") : t("মার্ক আপডেট", "Mark Update")}</h1>
        <p className="mt-1 text-meta text-text-muted">{t("পরীক্ষা, শাখা ও বিষয় নির্বাচন করে নম্বর এন্ট্রি করুন", "Select exam, section & subject to enter marks")}</p>
      </header>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-surface p-5 shadow-e1">
        <Field label={t("পরীক্ষা", "Exam")} required className="w-55 max-w-full">
          <Select value={examId} placeholder={exams.isLoading ? t("লোড হচ্ছে…", "Loading…") : t("নির্বাচন", "Select")} options={(exams.data ?? []).map((e) => ({ value: e.id, label: e.name }))} onChange={(e) => setExamId(e.target.value)} />
        </Field>
        <Field label={t("শাখা", "Section")} required className="w-55 max-w-full">
          <Select value={sectionId} placeholder={t("নির্বাচন", "Select")} options={opt(sections.data)} onChange={(e) => setSectionId(e.target.value)} />
        </Field>
        <Field label={t("বিষয়", "Subject")} required className="w-55 max-w-full">
          <Select value={subjectId} placeholder={t("নির্বাচন", "Select")} options={opt(subjects.data)} onChange={(e) => setSubjectId(e.target.value)} />
        </Field>
        {/* Read-only: derived above, so the grid and the GPA cannot disagree. */}
        <Field label={t("পূর্ণ নম্বর", "Full marks")} className="w-28">
          <Input type="number" value={String(full.value)} readOnly disabled className="font-latin" />
        </Field>
      </div>

      {ready ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-info-fg/30 bg-info-bg px-4 py-3 text-meta text-info-fg">
          <Info size={15} className="mt-px shrink-0" />
          <span>
            {full.source === "subject"
              ? t(`পূর্ণ নম্বর ${n(full.value)} — বিষয়ের নিজস্ব সেটিং থেকে।`, `Full marks ${full.value} — from this subject's own setting.`)
              : full.source === "config"
                ? t(`পূর্ণ নম্বর ${n(full.value)} — প্রতিষ্ঠানের মার্ক কনফিগ থেকে।`, `Full marks ${full.value} — from the institution mark config.`)
                : t(`পূর্ণ নম্বর ${n(full.value)} — কোথাও নির্ধারিত নেই, ডিফল্ট ব্যবহার হচ্ছে। বিষয় সেটিংস বা মার্ক কনফিগে নির্ধারণ করুন।`, `Full marks ${full.value} — not configured anywhere, using the default. Set it in Subject settings or Mark config.`)}
          </span>
        </div>
      ) : null}

      {/* Restore is never silent: a draft that reapplies itself on load is
          indistinguishable from data the operator just selected. */}
      {draft.pending ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-warning-fg/30 bg-warning-bg px-4 py-3 text-meta text-warning-fg">
          <History size={16} className="shrink-0" />
          <span className="flex-1">
            {t(
              `${formatDateTime(draft.savedAt)} এ অসংরক্ষিত এন্ট্রি পাওয়া গেছে।`,
              `Unsaved entries found from ${formatDateTime(draft.savedAt)}.`,
            )}
          </span>
          <Button variant="secondary" className="h-8 px-3" onClick={() => { const d = draft.accept(); if (d) setMarks(d); }}>
            {t("ফিরিয়ে আনুন", "Restore")}
          </Button>
          <Button variant="ghost" className="h-8 px-3" onClick={() => draft.discard()}>
            {t("বাদ দিন", "Discard")}
          </Button>
        </div>
      ) : null}

      {!ready ? (
        <EmptyState icon={<ClipboardList size={22} />} title={t("পরীক্ষা, শাখা ও বিষয় নির্বাচন করুন", "Select exam, section and subject")} />
      ) : students.isLoading ? (
        <div className="flex flex-col gap-2 rounded-2xl bg-surface p-5 shadow-e1">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-11" />)}</div>
      ) : students.isError ? (
        <ErrorState title={t("তালিকা লোড করা যায়নি", "Could not load list")} />
      ) : rows.length === 0 ? (
        <EmptyState icon={<ClipboardList size={22} />} title={t("এই শাখায় কোনো শিক্ষার্থী নেই", "No students in this section")} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border-default bg-surface shadow-e1">
          <div className="min-w-160">
            <div className="flex items-center gap-3 border-b border-border-default px-5 py-3 text-meta font-semibold text-text-muted">
              <div className="w-15">{t("রোল", "Roll")}</div>
              <div className="flex-1">{t("শিক্ষার্থী", "Student")}</div>
              <div className="w-40 text-center">{t("প্রাপ্ত নম্বর", "Marks obtained")} ({n(full.value)})</div>
              <div className="w-24 text-center">{t("অনুপস্থিত", "Absent")}</div>
            </div>
            {rows.map((r, i) => {
              const m = marks[r.studentId] ?? { marks: "", absent: false };
              const over = !m.absent && m.marks !== "" && !(Number(m.marks) >= 0 && Number(m.marks) <= full.value);
              return (
                <div key={r.enrollmentId} className={cn("flex items-center gap-3 px-5 py-3", i % 2 === 1 && "bg-sunken")}>
                  <div className="w-15 text-meta text-text-secondary tnum">{r.roll != null ? n(r.roll) : "—"}</div>
                  <div className="flex-1 text-sm font-medium text-text-primary">{isBn ? r.name_bn : r.name_en}</div>
                  <div className="w-40 px-2">
                    <Input type="number" min={0} max={full.value} value={m.marks} disabled={m.absent}
                      aria-invalid={over}
                      aria-label={t(`${r.name_bn} এর নম্বর`, `Marks for ${r.name_en}`)}
                      onChange={(e) => setMark(r.studentId, { marks: e.target.value })} className="h-9 text-center font-latin" />
                    {over ? <p role="alert" className="mt-0.5 text-xs text-danger-fg">{t(`০–${n(full.value)}`, `0–${full.value}`)}</p> : null}
                  </div>
                  <div className="flex w-24 justify-center">
                    <Checkbox checked={m.absent} aria-label={t(`${r.name_bn} অনুপস্থিত`, `${r.name_en} absent`)}
                      onChange={(e) => setMark(r.studentId, { absent: e.target.checked, marks: e.target.checked ? "" : m.marks })} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <SaveBar status={<><UnsavedDot /><span>{ready && rows.length ? t(`${rows.length} জন শিক্ষার্থী`, `${rows.length} students`) : t("নির্বাচন করুন", "Make a selection")}</span></>}>
        <Button variant="primary" onClick={submit} disabled={!ready || !rows.length || save.isPending || invalid.length > 0}><Save size={16} /> {save.isPending ? t("সংরক্ষণ হচ্ছে…", "Saving…") : t("জমা দিন", "Submit")}</Button>
      </SaveBar>
    </div>
  );
}
