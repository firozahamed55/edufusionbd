"use client";

import { useEffect, useState } from "react";
import { Save, ClipboardList } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { Field, Select, Input, Button, SaveBar, UnsavedDot, Skeleton, EmptyState, ErrorState, useToast, Breadcrumb } from "@/shared/ui";
import { useClassSectionsLookup, useSubjects } from "@/shared/services/lookups/hooks";
import { useSectionStudents } from "@/shared/services/roster/hooks";
import type { Option } from "@/shared/services/lookups/api";
import { useExams, useSectionClassId, useExistingMarks, useSaveMarks } from "../logic/hooks";

/** Live mark entry/update — pick exam + section + subject, enter marks, save. */
export function MarksEntry({ mode }: { mode: "input" | "update" }) {
  const { t, n, isBn } = useT();
  const toast = useToast();
  const [examId, setExamId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [full, setFull] = useState("100");
  const [marks, setMarks] = useState<Record<string, { marks: string; absent: boolean }>>({});

  const exams = useExams();
  const sections = useClassSectionsLookup();
  const subjects = useSubjects();
  const students = useSectionStudents(sectionId || null);
  const classId = useSectionClassId(sectionId || null);
  const existing = useExistingMarks(examId || null, classId.data ?? null, subjectId || null);
  const save = useSaveMarks();

  const opt = (list?: Option[]) => (list ?? []).map((o) => ({ value: o.value, label: isBn ? o.label_bn : o.label_en }));
  const rows = students.data ?? [];

  useEffect(() => {
    if (!rows.length) return;
    const ex = existing.data ?? {};
    setMarks(Object.fromEntries(rows.map((r) => [r.studentId, ex[r.studentId] ?? { marks: "", absent: false }])));
  }, [students.data, existing.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const ready = Boolean(examId && sectionId && subjectId);
  const setMark = (id: string, patch: Partial<{ marks: string; absent: boolean }>) => setMarks((p) => ({ ...p, [id]: { ...(p[id] ?? { marks: "", absent: false }), ...patch } }));

  function submit() {
    if (!ready || !rows.length) { toast({ title: t("পরীক্ষা, শাখা ও বিষয় নির্বাচন করুন", "Select exam, section and subject"), variant: "error" }); return; }
    save.mutate(
      { exam_id: examId, class_section_id: sectionId, subject_id: subjectId, full_marks: full,
        entries: rows.map((r) => ({ student_id: r.studentId, marks_obtained: marks[r.studentId]?.absent ? "" : (marks[r.studentId]?.marks ?? ""), is_absent: marks[r.studentId]?.absent ?? false })) },
      {
        onSuccess: (count) => toast({ title: t(`${count} জনের নম্বর সংরক্ষিত হয়েছে`, `Saved marks for ${count}`), variant: "success" }),
        onError: (e: unknown) => toast({ title: e instanceof Error ? e.message : t("সংরক্ষণ ব্যর্থ", "Save failed"), variant: "error" }),
      },
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <Breadcrumb
          items={[
            { label: t("পরীক্ষা ও ফলাফল", "Exam & Results"), href: "/admin/exam/settings" },
            { label: mode === "input" ? t("মার্ক ইনপুট", "Mark Input") : t("মার্ক আপডেট", "Mark Update") },
          ]}
        />
        <h1 className="mt-1.5 text-h4 font-bold text-text-primary">{mode === "input" ? t("মার্ক ইনপুট", "Mark Input") : t("মার্ক আপডেট", "Mark Update")}</h1>
        <p className="mt-1 text-meta text-text-muted">{t("পরীক্ষা, শাখা ও বিষয় নির্বাচন করে নম্বর এন্ট্রি করুন", "Select exam, section & subject to enter marks")}</p>
      </header>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-surface p-5 shadow-e3">
        <Field label={t("পরীক্ষা", "Exam")} required className="w-55 max-w-full">
          <Select value={examId} placeholder={exams.isLoading ? t("লোড হচ্ছে…", "Loading…") : t("নির্বাচন", "Select")} options={(exams.data ?? []).map((e) => ({ value: e.id, label: e.name }))} onChange={(e) => setExamId(e.target.value)} />
        </Field>
        <Field label={t("শাখা", "Section")} required className="w-55 max-w-full">
          <Select value={sectionId} placeholder={t("নির্বাচন", "Select")} options={opt(sections.data)} onChange={(e) => setSectionId(e.target.value)} />
        </Field>
        <Field label={t("বিষয়", "Subject")} required className="w-55 max-w-full">
          <Select value={subjectId} placeholder={t("নির্বাচন", "Select")} options={opt(subjects.data)} onChange={(e) => setSubjectId(e.target.value)} />
        </Field>
        <Field label={t("পূর্ণ নম্বর", "Full marks")} className="w-28"><Input type="number" min={1} value={full} onChange={(e) => setFull(e.target.value)} className="font-latin" /></Field>
      </div>

      {!ready ? (
        <EmptyState icon={<ClipboardList size={22} />} title={t("পরীক্ষা, শাখা ও বিষয় নির্বাচন করুন", "Select exam, section and subject")} />
      ) : students.isLoading ? (
        <div className="flex flex-col gap-2 rounded-2xl bg-surface p-5 shadow-e3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-11" />)}</div>
      ) : students.isError ? (
        <ErrorState title={t("তালিকা লোড করা যায়নি", "Could not load list")} />
      ) : rows.length === 0 ? (
        <EmptyState icon={<ClipboardList size={22} />} title={t("এই শাখায় কোনো শিক্ষার্থী নেই", "No students in this section")} />
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-surface shadow-e3">
          <div className="min-w-160">
            <div className="flex items-center gap-3 border-b border-border-default px-5 py-3 text-[12.5px] font-semibold text-text-muted">
              <div className="w-15">{t("রোল", "Roll")}</div>
              <div className="flex-1">{t("শিক্ষার্থী", "Student")}</div>
              <div className="w-40 text-center">{t("প্রাপ্ত নম্বর", "Marks obtained")} ({n(full)})</div>
              <div className="w-24 text-center">{t("অনুপস্থিত", "Absent")}</div>
            </div>
            {rows.map((r, i) => {
              const m = marks[r.studentId] ?? { marks: "", absent: false };
              return (
                <div key={r.enrollmentId} className={cn("flex items-center gap-3 px-5 py-3", i % 2 === 1 && "bg-sunken")}>
                  <div className="w-15 text-meta text-text-secondary tnum">{r.roll != null ? n(r.roll) : "—"}</div>
                  <div className="flex-1 text-sm font-medium text-text-primary">{isBn ? r.name_bn : r.name_en}</div>
                  <div className="w-40 px-2">
                    <Input type="number" min={0} max={Number(full) || undefined} value={m.marks} disabled={m.absent}
                      onChange={(e) => setMark(r.studentId, { marks: e.target.value })} className="h-9 text-center font-latin" />
                  </div>
                  <div className="flex w-24 justify-center">
                    <input type="checkbox" checked={m.absent} onChange={(e) => setMark(r.studentId, { absent: e.target.checked, marks: e.target.checked ? "" : m.marks })} className="size-4 accent-primary" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <SaveBar status={<><UnsavedDot /><span>{ready && rows.length ? t(`${rows.length} জন শিক্ষার্থী`, `${rows.length} students`) : t("নির্বাচন করুন", "Make a selection")}</span></>}>
        <Button variant="primary" onClick={submit} disabled={!ready || !rows.length || save.isPending}><Save size={16} /> {save.isPending ? t("সংরক্ষণ হচ্ছে…", "Saving…") : t("জমা দিন", "Submit")}</Button>
      </SaveBar>
    </div>
  );
}
