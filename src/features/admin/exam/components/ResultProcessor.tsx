"use client";

import { useMemo, useState } from "react";
import { Cpu, Award, FileSpreadsheet, FileText, Send, EyeOff } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { formatDateTime } from "@/shared/lib/format";
import {
  Field, Select, Button, Skeleton, EmptyState, ErrorState, useToast, Badge, StatCard,
  ConfirmDialog, DangerConfirm,
} from "@/shared/ui";
import { DocumentPreview, useLetterhead, useDocSignatures } from "@/shared/documents";
import { useClassSectionsLookup } from "@/shared/services/lookups/hooks";
import type { Option } from "@/shared/services/lookups/api";
import {
  useExams, useExamResults, useProcessExam, useTabulation, useResultStatus,
  useSetPublication, useExamConfig,
} from "../logic/hooks";
import { TabulationSheets } from "../documents/TabulationDoc";
import { MarksheetSheets, type MarksheetConfig } from "../documents/MarksheetDoc";
import { useErrorMessage } from "@/shared/services/errors";

const resultTone = (r: string | null) => (r === "pass" ? "bg-success-bg text-success-fg" : r === "fail" ? "bg-danger-bg text-danger-fg" : "bg-sunken text-text-secondary");

/**
 * Exam results: process → verify → publish, plus the two artefacts a school
 * actually hands out (SRA A-5.2).
 *
 * WHAT CHANGED. Processing used to be the whole workflow, and it made results
 * visible to every parent the instant the button was pressed — including a run
 * done to sanity-check a grading scheme. Now processing produces a `processed`
 * exam that only staff can see, and publication is a separate, audited act
 * that parent RLS reads. Re-processing a published exam is refused by the RPC,
 * not by this screen, so the guard survives any other caller.
 */
export function ResultProcessor({ mode }: { mode: "process" | "view" }) {
  const { t, n, isBn } = useT();
  const msg = useErrorMessage();
  const toast = useToast();
  const [examId, setExamId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [doc, setDoc] = useState<"tabulation" | "marksheet" | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);

  const exams = useExams();
  const sections = useClassSectionsLookup();
  const results = useExamResults(examId || null, mode === "view" ? sectionId || null : null);
  const status = useResultStatus(examId || null);
  const process = useProcessExam();
  const publication = useSetPublication();
  const opt = (list?: Option[]) => (list ?? []).map((o) => ({ value: o.value, label: isBn ? o.label_bn : o.label_en }));
  const rows = results.data ?? [];

  const examName = (exams.data ?? []).find((e) => e.id === examId)?.name ?? "";
  const sectionLabel = sectionId ? (opt(sections.data).find((o) => o.value === sectionId)?.label ?? "—") : t("সকল শাখা", "All sections");
  const published = status.data?.status === "published";

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
        <p className="mt-1 text-meta text-text-muted">{isProcess ? t("নম্বর থেকে GPA, গ্রেড ও মেধাক্রম গণনা করুন, তারপর প্রকাশ করুন", "Compute GPA, grade & merit rank from marks, then publish") : t("প্রক্রিয়াকৃত ফলাফল দেখুন ও প্রিন্ট করুন", "View & print processed results")}</p>
      </header>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-surface p-5 shadow-e1">
        <Field label={t("পরীক্ষা", "Exam")} required className="w-65 max-w-full">
          <Select value={examId} placeholder={exams.isLoading ? t("লোড হচ্ছে…", "Loading…") : t("নির্বাচন", "Select")} options={(exams.data ?? []).map((e) => ({ value: e.id, label: e.name }))} onChange={(e) => setExamId(e.target.value)} />
        </Field>
        <Field label={t("শাখা", "Section")} className="w-55 max-w-full">
          <Select value={sectionId} placeholder={t("সকল শাখা", "All sections")} options={[{ value: "", label: t("সকল শাখা", "All sections") }, ...opt(sections.data)]} onChange={(e) => setSectionId(e.target.value)} />
        </Field>
        <div className="flex-1" />
        {isProcess ? (
          <Button variant="primary" className="h-10.5 px-6" onClick={run} disabled={!examId || process.isPending || published}>
            <Cpu size={16} /> {process.isPending ? t("প্রক্রিয়াকরণ…", "Processing…") : t("ফলাফল প্রক্রিয়া করুন", "Process results")}
          </Button>
        ) : null}
        <Button variant="secondary" className="h-10.5" onClick={() => setDoc("tabulation")} disabled={rows.length === 0}>
          <FileSpreadsheet size={16} /> {t("ট্যাবুলেশন শীট", "Tabulation sheet")}
        </Button>
        <Button variant="secondary" className="h-10.5" onClick={() => setDoc("marksheet")} disabled={rows.length === 0}>
          <FileText size={16} /> {t("মার্কশিট", "Marksheets")}
        </Button>
      </div>

      {examId ? (
        <PublicationBar
          status={status.data?.status ?? "draft"}
          publishedAt={status.data?.published_at ?? null}
          publishedBy={status.data?.published_by ?? null}
          resultCount={status.data?.result_count ?? 0}
          busy={publication.isPending}
          onPublish={() => setPublishing(true)}
          onUnpublish={() => setUnpublishing(true)}
        />
      ) : null}

      {examId ? <StatsPanel examId={examId} sectionId={sectionId || null} /> : null}

      {!examId ? (
        <EmptyState icon={<Award size={22} />} title={t("একটি পরীক্ষা নির্বাচন করুন", "Select an exam")} />
      ) : results.isLoading ? (
        <div className="flex flex-col gap-2 rounded-2xl bg-surface p-5 shadow-e1">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-11" />)}</div>
      ) : results.isError ? (
        <ErrorState title={t("ফলাফল লোড করা যায়নি", "Could not load results")} />
      ) : rows.length === 0 ? (
        <EmptyState icon={<Award size={22} />} title={t("এখনও কোনো প্রক্রিয়াকৃত ফলাফল নেই", "No processed results yet")} description={isProcess ? t("নম্বর এন্ট্রির পর ‘ফলাফল প্রক্রিয়া করুন’ চাপুন।", "After entering marks, click Process results.") : undefined} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border-default bg-surface shadow-e1">
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

      {doc ? (
        <ResultDocument
          kind={doc}
          examId={examId}
          examName={examName}
          sectionId={sectionId || null}
          sectionLabel={sectionLabel}
          onClose={() => setDoc(null)}
        />
      ) : null}

      <ConfirmDialog
        open={publishing}
        onClose={() => setPublishing(false)}
        title={t("ফলাফল প্রকাশ করুন", "Publish results")}
        description={t(
          `${n(status.data?.result_count ?? 0)} জন শিক্ষার্থীর ফলাফল অভিভাবক অ্যাপে দৃশ্যমান হবে। প্রকাশের পর নম্বর পরিবর্তন করতে হলে আগে প্রকাশ বাতিল করতে হবে।`,
          `Results for ${status.data?.result_count ?? 0} students become visible in the parent app. After publication, changing marks requires unpublishing first.`,
        )}
        confirmLabel={t("প্রকাশ করুন", "Publish")}
        cancelLabel={t("বাতিল", "Cancel")}
        loading={publication.isPending}
        onConfirm={() =>
          publication.mutate({ examId, publish: true }, {
            onSuccess: () => { toast({ title: t("ফলাফল প্রকাশিত হয়েছে", "Results published"), variant: "success" }); setPublishing(false); },
            onError: (e: unknown) => toast({ title: msg(e, { bn: "প্রকাশ ব্যর্থ", en: "Publish failed" }), variant: "error" }),
          })
        }
      />

      {unpublishing ? (
        <DangerConfirm
          open
          onClose={() => setUnpublishing(false)}
          title={t("প্রকাশ বাতিল করুন", "Unpublish results")}
          description={t(
            "অভিভাবকরা ইতিমধ্যেই এই ফলাফল দেখে ফেলেছেন। প্রকাশ বাতিল করলে তা তাঁদের কাছ থেকে সরে যাবে — এটি একটি দৃশ্যমান পরিবর্তন এবং অডিট লগে লেখা হবে।",
            "Parents have already seen these results. Unpublishing takes them away again — a visible change, and it is written to the audit log.",
          )}
          count={status.data?.result_count ?? 0}
          confirmLabel={t("প্রকাশ বাতিল করুন", "Unpublish")}
          cancelLabel={t("ফিরে যান", "Go back")}
          typeToConfirmLabel={(phrase) => t(`নিশ্চিত করতে ${n(phrase)} টাইপ করুন`, `Type ${phrase} to confirm`)}
          reasonLabel={t("কারণ", "Reason")}
          loading={publication.isPending}
          onConfirm={(reason) =>
            publication.mutate({ examId, publish: false, reason }, {
              onSuccess: () => { toast({ title: t("প্রকাশ বাতিল হয়েছে", "Results unpublished"), variant: "success" }); setUnpublishing(false); },
              onError: (e: unknown) => toast({ title: msg(e, { bn: "বাতিল ব্যর্থ", en: "Unpublish failed" }), variant: "error" }),
            })
          }
        />
      ) : null}
    </div>
  );
}

/** Where the exam is in process → verify → publish, and the one action available. */
function PublicationBar({
  status, publishedAt, publishedBy, resultCount, busy, onPublish, onUnpublish,
}: {
  status: "draft" | "processed" | "published";
  publishedAt: string | null;
  publishedBy: string | null;
  resultCount: number;
  busy: boolean;
  onPublish: () => void;
  onUnpublish: () => void;
}) {
  const { t, n } = useT();
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border-default bg-surface px-5 py-3.5 shadow-e1">
      {status === "published" ? (
        <Badge tone="success" dot>{t("প্রকাশিত", "Published")}</Badge>
      ) : status === "processed" ? (
        <Badge tone="warning" dot>{t("প্রক্রিয়াকৃত — অপ্রকাশিত", "Processed — not published")}</Badge>
      ) : (
        <Badge tone="neutral" dot>{t("খসড়া", "Draft")}</Badge>
      )}
      <p className="min-w-0 flex-1 text-meta text-text-secondary">
        {status === "published"
          ? t(
              `${n(resultCount)} জনের ফলাফল অভিভাবকদের কাছে দৃশ্যমান${publishedBy ? ` — ${publishedBy}` : ""}${publishedAt ? `, ${formatDateTime(publishedAt)}` : ""}`,
              `${resultCount} results visible to parents${publishedBy ? ` — ${publishedBy}` : ""}${publishedAt ? `, ${formatDateTime(publishedAt)}` : ""}`,
            )
          : status === "processed"
            ? t(
                `${n(resultCount)} জনের ফলাফল গণনা হয়েছে, কিন্তু অভিভাবকরা এখনও দেখতে পাচ্ছেন না।`,
                `${resultCount} results computed; parents cannot see them yet.`,
              )
            : t("এই পরীক্ষার ফলাফল এখনও প্রক্রিয়া করা হয়নি।", "Results for this exam have not been processed.")}
      </p>
      {status === "published" ? (
        <Button variant="secondary" onClick={onUnpublish} disabled={busy}>
          <EyeOff size={15} /> {t("প্রকাশ বাতিল", "Unpublish")}
        </Button>
      ) : (
        <Button variant="primary" onClick={onPublish} disabled={busy || status !== "processed" || resultCount === 0}>
          <Send size={15} /> {t("প্রকাশ করুন", "Publish")}
        </Button>
      )}
    </div>
  );
}

/** Pass rate, average GPA and grade distribution — "the analysis a head
 *  teacher wants immediately" (A-5.2), which the screen did not have. */
function StatsPanel({ examId, sectionId }: { examId: string; sectionId: string | null }) {
  const { t, n } = useT();
  const tab = useTabulation(examId, sectionId);
  const stats = tab.data?.stats;
  if (!stats || stats.appeared === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t("অংশগ্রহণ", "Appeared")} value={n(stats.appeared)} />
        <StatCard label={t("পাসের হার", "Pass rate")} value={`${n(stats.pass_rate)}%`} />
        <StatCard label={t("গড় GPA", "Average GPA")} value={n(stats.avg_gpa)} />
        <StatCard label={t("সর্বোচ্চ নম্বর", "Highest total")} value={n(stats.highest)} />
      </div>
      {stats.by_grade.length > 0 ? (
        <div className="flex flex-wrap gap-2 rounded-2xl bg-surface p-4 shadow-e1">
          <span className="text-meta font-semibold text-text-secondary">{t("গ্রেড বণ্টন", "Grade distribution")}</span>
          {stats.by_grade.map((g) => (
            <Badge key={g.grade} tone="primary">{g.grade} · {n(g.count)}</Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ResultDocument({
  kind, examId, examName, sectionId, sectionLabel, onClose,
}: {
  kind: "tabulation" | "marksheet";
  examId: string;
  examName: string;
  sectionId: string | null;
  sectionLabel: string;
  onClose: () => void;
}) {
  const { t } = useT();
  const tab = useTabulation(examId, sectionId);
  const letterhead = useLetterhead();
  const signatures = useDocSignatures();
  const config = useExamConfig("marksheet");

  const marksheetConfig = useMemo<MarksheetConfig>(() => {
    const cfg = (config.data ?? {}) as Record<string, unknown>;
    return {
      show_position: cfg.show_position !== false,
      show_attendance: !!cfg.show_attendance,
      show_comment: !!cfg.show_comment,
      comment: typeof cfg.comment === "string" ? cfg.comment : undefined,
      footer_note: typeof cfg.footer_note === "string" ? cfg.footer_note : undefined,
    };
  }, [config.data]);

  const title = kind === "tabulation"
    ? `${t("ট্যাবুলেশন শীট", "Tabulation Sheet")} — ${examName}`
    : `${t("মার্কশিট", "Marksheets")} — ${examName}`;

  return (
    <DocumentPreview title={title} paper={kind === "tabulation" ? "a4-landscape" : "a5"} onClose={onClose}>
      {tab.isLoading ? (
        <p className="p-8 text-meta text-text-muted">{t("লোড হচ্ছে…", "Loading…")}</p>
      ) : !tab.data || tab.data.rows.length === 0 ? (
        <p className="p-8 text-meta text-text-muted">{t("এই নির্বাচনে কোনো ফলাফল নেই।", "No results for this selection.")}</p>
      ) : kind === "tabulation" ? (
        <TabulationSheets
          tabulation={tab.data}
          examName={examName}
          sectionLabel={sectionLabel}
          letterhead={letterhead.data}
          signatures={signatures.data}
        />
      ) : (
        <MarksheetSheets
          rows={tab.data.rows}
          subjects={tab.data.subjects}
          stats={tab.data.stats}
          examName={examName}
          sectionLabel={sectionLabel}
          config={marksheetConfig}
          letterhead={letterhead.data}
          signatures={signatures.data}
        />
      )}
    </DocumentPreview>
  );
}
