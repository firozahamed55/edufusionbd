"use client";

import { useMemo, useState } from "react";
import { ArrowUp, Users, AlertTriangle } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { Button, Field, Select, SaveBar, UnsavedDot, Checkbox, Badge, DangerConfirm, Skeleton, EmptyState, ErrorState, useToast } from "@/shared/ui";
import { useClassSectionsLookup, useAcademicYears } from "@/shared/services/lookups/hooks";
import type { Option } from "@/shared/services/lookups/api";
import { useMigrationCandidates, useMigrationExams, useRunMigration } from "../logic/hooks";
import type { RunMigrationPayload, MigrationCandidate } from "../logic/api";
import { useErrorMessage } from "@/shared/services/errors";

/**
 * Shared migration runner for both "with merit" and "no-merit" flows — the two
 * screens are the same operation differing only in `type` (merit_rank ordering).
 * Live: source section → students from Supabase → select → fn_run_migration
 * (transaction-safe promotion into the target section).
 *
 * MERIT RANK COMES FROM AN EXAM (SRA F-5). This screen used to send
 * `merit_rank: idx + 1` — the student's index in the source roster, i.e. roll
 * order — and `result: "pass"` hardcoded for everyone. So "With Merit" wrote a
 * merit ordering unrelated to merit, and promoted failing students as passes,
 * into a permanent academic record, through a transactional write that leaves
 * no pre-state to compare against.
 *
 * The three rules that replace it:
 *  1. Merit promotion requires an exam. The ranking already exists in
 *     `exam_result` — `fn_process_exam_result` computes it set-based in
 *     Postgres — and was simply never read.
 *  2. `result` is read from that row, never assumed.
 *  3. The run is refused while any selected student has no processed result,
 *     and a dry-run preview states the split before the irreversible commit.
 */
export function MigrationRunner({ type }: { type: "merit" | "no_merit" }) {
  const isMerit = type === "merit";
  const { t, n, isBn } = useT();
  const msg = useErrorMessage();
  const toast = useToast();

  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [examId, setExamId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);

  const sections = useClassSectionsLookup();
  const years = useAcademicYears();
  const exams = useMigrationExams();
  // No-merit promotion needs no exam, so it never pays for the results query.
  const students = useMigrationCandidates(sourceId || null, isMerit ? examId || null : null);
  const run = useRunMigration();

  const opt = (list?: Option[]) => (list ?? []).map((o) => ({ value: o.value, label: isBn ? o.label_bn : o.label_en }));
  // Memoised: `?? []` is a fresh array each render, which would make every
  // downstream useMemo recompute forever.
  const rows = useMemo(() => students.data ?? [], [students.data]);

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
  const chosen = useMemo(() => rows.filter((r) => selected.has(r.enrollmentId)), [rows, selected]);

  /**
   * The dry run. What the operator sees before committing, rather than after
   * discovering it in a student's transcript.
   */
  const preview = useMemo(() => {
    if (!isMerit) return { promote: chosen.length, unprocessed: 0, failed: 0 };
    const unprocessed = chosen.filter((r) => r.unprocessed).length;
    const failed = chosen.filter((r) => !r.unprocessed && r.result === "fail").length;
    return { promote: chosen.length - unprocessed, unprocessed, failed };
  }, [chosen, isMerit]);

  const needsExam = isMerit && !examId;
  const blockedByUnprocessed = isMerit && preview.unprocessed > 0;
  const canRun =
    Boolean(sourceId && targetId && sourceId !== targetId && selected.size > 0 && yearId) &&
    !needsExam && !blockedByUnprocessed && !run.isPending;

  function submit() {
    if (sourceId === targetId) { toast({ title: t("উৎস ও লক্ষ্য শাখা ভিন্ন হতে হবে", "Source and target must differ"), variant: "error" }); return; }
    if (needsExam) { toast({ title: t("মেধাক্রমের জন্য পরীক্ষা নির্বাচন করুন", "Pick the exam that determines merit"), variant: "error" }); return; }
    // Refuse rather than invent. A student with no processed result cannot be
    // ranked and cannot be judged pass or fail — promoting them anyway is
    // exactly the defect this screen is being fixed for.
    if (blockedByUnprocessed) {
      toast({ title: t(`${n(preview.unprocessed)} জন শিক্ষার্থীর ফলাফল প্রক্রিয়াকৃত নয়`, `${preview.unprocessed} selected students have no processed result`), variant: "error" });
      return;
    }
    if (!canRun) { toast({ title: t("শাখা ও শিক্ষার্থী নির্বাচন করুন", "Select sections and students"), variant: "error" }); return; }
    setConfirming(true);
  }

  function commit() {
    const payload: RunMigrationPayload = {
      academic_year_id: yearId,
      source_class_section_id: sourceId,
      target_class_section_id: targetId,
      type,
      students: chosen.map((r) => ({
        student_id: r.studentId,
        source_enrollment_id: r.enrollmentId,
        // The real rank from exam_result — never the row's position on screen.
        merit_rank: isMerit ? r.merit_rank ?? undefined : undefined,
        // The real outcome — never a hardcoded "pass".
        result: r.result ?? undefined,
      })),
    };
    run.mutate(payload, {
      onSuccess: () => {
        setConfirming(false);
        toast({ title: t(`${n(chosen.length)} জন শিক্ষার্থী উন্নীত হয়েছে`, `${chosen.length} students promoted`), variant: "success" });
        setSelected(new Set());
      },
      onError: (e: unknown) => {
        setConfirming(false);
        toast({ title: msg(e, { bn: "মাইগ্রেশন ব্যর্থ", en: "Migration failed" }), variant: "error" });
      },
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="mt-1.5 text-h4 font-bold text-text-primary">{isMerit ? t("মাইগ্রেশন — মেধাক্রমসহ", "Migration — With Merit") : t("মাইগ্রেশন — মেধাক্রম ছাড়া", "Migration — Without Merit")}</h1>
        <p className="mt-1 text-meta text-text-muted">{t("শিক্ষার্থীদের পরবর্তী শ্রেণিতে উন্নীত করুন", "Promote students to the next class")}</p>
      </header>

      <div className={cn("grid grid-cols-1 gap-3 rounded-2xl bg-surface p-5 shadow-e1 sm:items-end", isMerit ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
        <Field label={t("উৎস শ্রেণি ও শাখা", "Source Class & Section")} required>
          <Select value={sourceId} placeholder={sections.isLoading ? t("লোড হচ্ছে…", "Loading…") : t("নির্বাচন করুন", "Select")} options={opt(sections.data)}
            onChange={(e) => { setSourceId(e.target.value); setSelected(new Set()); }} />
        </Field>
        <Field label={t("লক্ষ্য শ্রেণি ও শাখা", "Target Class & Section")} required>
          <Select value={targetId} placeholder={t("নির্বাচন করুন", "Select")} options={opt(sections.data)} onChange={(e) => setTargetId(e.target.value)} />
        </Field>
        {isMerit ? (
          <Field label={t("মেধাক্রমের ভিত্তি (পরীক্ষা)", "Merit basis (exam)")} required>
            <Select value={examId} placeholder={exams.isLoading ? t("লোড হচ্ছে…", "Loading…") : t("পরীক্ষা নির্বাচন করুন", "Select an exam")}
              options={(exams.data ?? []).map((e) => ({ value: e.id, label: e.name }))}
              onChange={(e) => { setExamId(e.target.value); setSelected(new Set()); }} />
          </Field>
        ) : null}
      </div>

      {needsExam && sourceId ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-warning-fg/30 bg-warning-bg px-4 py-3 text-meta text-warning-fg">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <p>{t("মেধাক্রম নির্ধারণের জন্য একটি প্রক্রিয়াকৃত পরীক্ষা বেছে নিন। মেধাক্রম ও পাস/ফেল ঐ পরীক্ষার ফলাফল থেকে নেওয়া হবে।", "Pick a processed exam. Merit rank and pass/fail are read from that exam's results, not assumed.")}</p>
        </div>
      ) : null}

      {!sourceId ? (
        <EmptyState icon={<Users size={22} />} title={t("উৎস শাখা নির্বাচন করুন", "Select a source section")} description={t("উন্নীত করার জন্য শিক্ষার্থী তালিকা লোড করুন।", "Load the student list to promote them.")} />
      ) : students.isLoading ? (
        <div className="flex flex-col gap-2 rounded-2xl bg-surface p-5 shadow-e1">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-11" />)}</div>
      ) : students.isError ? (
        <ErrorState title={t("তালিকা লোড করা যায়নি", "Could not load list")} description={msg(students.error)} />
      ) : rows.length === 0 ? (
        <EmptyState icon={<Users size={22} />} title={t("এই শাখায় কোনো শিক্ষার্থী নেই", "No students in this section")} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border-default bg-surface shadow-e1">
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
            {isMerit ? <div className="w-28">{t("ফলাফল", "Result")}</div> : null}
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
                {isMerit ? (
                  <div className="w-24 text-meta font-semibold text-text-primary tnum">
                    {r.merit_rank != null ? n(r.merit_rank) : <span className="text-text-muted">—</span>}
                  </div>
                ) : null}
                {isMerit ? <div className="w-28"><ResultBadge row={r} /></div> : null}
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

      {blockedByUnprocessed ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-danger-fg/30 bg-danger-bg px-4 py-3 text-meta text-danger-fg">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <p>{t(
            `নির্বাচিতদের মধ্যে ${n(preview.unprocessed)} জনের এই পরীক্ষার ফলাফল প্রক্রিয়াকৃত নয়। তাদের বাদ দিন অথবা আগে ফলাফল প্রসেস করুন।`,
            `${preview.unprocessed} of the selected students have no processed result for this exam. Deselect them, or process the exam results first.`,
          )}</p>
        </div>
      ) : null}

      <SaveBar
        status={<><UnsavedDot /><span>{selected.size > 0 ? t(`${selected.size} জন নির্বাচিত`, `${selected.size} selected`) : t("শিক্ষার্থী নির্বাচন করুন", "Select students to promote")}</span></>}
      >
        <Button variant="secondary" onClick={() => setSelected(new Set())} disabled={run.isPending || selected.size === 0}>{t("বাতিল করুন", "Clear")}</Button>
        <Button variant="primary" onClick={submit} disabled={!canRun}>{run.isPending ? t("চলছে…", "Running…") : t("মাইগ্রেশন করুন", "Run Migration")}</Button>
      </SaveBar>

      {/*
        Typed confirmation on the most destructive write in the product — the
        same weight Delete Fees carries, for an operation that is arguably worse
        because it rewrites academic history rather than financial records.
      */}
      <DangerConfirm
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={commit}
        loading={run.isPending}
        count={chosen.length}
        title={t("উন্নয়ন নিশ্চিত করুন", "Confirm promotion")}
        description={t(
          "এই কাজটি ফিরিয়ে আনা যায় শুধুমাত্র পুশব্যাক দিয়ে। নিচের সারসংক্ষেপ মিলিয়ে দেখুন।",
          "This can only be reversed through a pushback. Check the summary below before committing.",
        )}
        preview={
          <div className="flex flex-col gap-1.5 text-meta">
            <p>{t("উন্নীত হবে", "Will promote")}: <b className="tnum">{n(preview.promote)}</b></p>
            {isMerit ? <p>{t("ফলাফলে ফেল", "Recorded as fail")}: <b className="tnum">{n(preview.failed)}</b></p> : null}
            {isMerit ? <p className="text-text-muted">{t("মেধাক্রম ও ফলাফল নির্বাচিত পরীক্ষার প্রক্রিয়াকৃত ফলাফল থেকে নেওয়া হবে।", "Merit rank and result are taken from the selected exam's processed results.")}</p> : null}
            <ul className="mt-1 list-disc pl-4 text-text-secondary">
              {chosen.slice(0, 8).map((r) => (
                <li key={r.enrollmentId}>
                  {isBn ? r.name_bn : r.name_en}
                  {isMerit && r.merit_rank != null ? ` · ${t("মেধাক্রম", "rank")} ${n(r.merit_rank)}` : ""}
                </li>
              ))}
              {chosen.length > 8 ? <li>{t(`আরও ${n(chosen.length - 8)} জন`, `and ${chosen.length - 8} more`)}</li> : null}
            </ul>
          </div>
        }
        confirmLabel={t("উন্নীত করুন", "Promote")}
        cancelLabel={t("বাতিল", "Cancel")}
        typeToConfirmLabel={(phrase) => t(`নিশ্চিত করতে ${phrase} টাইপ করুন`, `Type ${phrase} to confirm`)}
      />
    </div>
  );
}

function ResultBadge({ row }: { row: MigrationCandidate }) {
  const { t } = useT();
  if (row.unprocessed) return <Badge tone="warning" dot>{t("প্রক্রিয়া হয়নি", "Unprocessed")}</Badge>;
  if (row.result === "fail") return <Badge tone="danger" dot>{t("ফেল", "Fail")}</Badge>;
  if (row.result === "pass") return <Badge tone="success" dot>{t("পাস", "Pass")}</Badge>;
  return <Badge tone="neutral">{row.result ?? "—"}</Badge>;
}
