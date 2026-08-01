"use client";

import { useMemo, useState } from "react";
import { Wand2, IdCard, Layers, Eye, Printer, Ban } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { formatDateTime } from "@/shared/lib/format";
import {
  Field, Input, Select, Checkbox, Button, EmptyState, Skeleton, useToast, PageHeader,
  Table, THead, TBody, TR, TH, TD, Badge, DangerConfirm,
} from "@/shared/ui";
import { DocumentPreview, THEMES, useLetterhead, useStudentPhotoUrls, type CardLayout } from "@/shared/documents";
import { useClasses, useClassSectionsLookup } from "@/shared/services/lookups/hooks";
import type { Option } from "@/shared/services/lookups/api";
import {
  useCreateIdBatch, useCreateAdmitBatch, useIdBatchDetails, useAdmitBatchDetails,
  useExamOptions, useBatchStudents, useSeatNumbers, useExamSubjects, useCancelBatch, useSetting,
} from "../logic/hooks";
import type { BatchDetail, BatchSpec } from "../logic/documents";
import { IdCardSheets } from "../documents/IdCardDoc";
import { AdmitCardSheets } from "../documents/AdmitCardDoc";
import { useErrorMessage } from "@/shared/services/errors";

const LAYOUTS: CardLayout[] = ["1up", "2up", "8up", "10up"];

/**
 * ID-card / Admit-card batches — configure, preview, create, print.
 *
 * SRA A-7 called this module's defining problem "seven screens, zero
 * artefacts": both output buttons were disabled and labelled "(soon)", the
 * card type and colour were free-text strings nothing read, there was no
 * preview, and the batch list showed class and roll range only. This screen is
 * now the whole loop — pick a cohort, see the actual card, create the batch,
 * reprint or cancel it later.
 */
export function BatchCreator({ kind }: { kind: "id" | "admit" }) {
  const isId = kind === "id";
  const { t, n, isBn } = useT();
  const msg = useErrorMessage();
  const toast = useToast();
  const [f, setF] = useState<Record<string, string>>({ theme: "indigo" });
  const up = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  const classes = useClasses();
  const sections = useClassSectionsLookup();
  const exams = useExamOptions();
  const createId = useCreateIdBatch();
  const createAdmit = useCreateAdmitBatch();
  const idBatches = useIdBatchDetails();
  const admitBatches = useAdmitBatchDetails();
  const cancel = useCancelBatch(kind);
  const pending = createId.isPending || createAdmit.isPending;
  const batches = (isId ? idBatches.data : admitBatches.data) ?? [];
  const loadingBatches = isId ? idBatches.isLoading : admitBatches.isLoading;

  /** The batch currently open in the preview — either a draft from the form
   *  above, or an existing batch being reprinted. */
  const [preview, setPreview] = useState<BatchDetail | null>(null);
  const [layout, setLayout] = useState<CardLayout>(isId ? "10up" : "2up");
  const [cancelling, setCancelling] = useState<BatchDetail | null>(null);

  const opt = (l?: Option[]) => (l ?? []).map((o) => ({ value: o.value, label: isBn ? o.label_bn : o.label_en }));
  const className = (id: string) => opt(classes.data).find((o) => o.value === id)?.label ?? "—";
  const sectionName = (id: string) => opt(sections.data).find((o) => o.value === id)?.label ?? null;

  /** The form as a batch spec, so Preview works BEFORE anything is written.
   *  An operator should not have to create 400 records to find out the card
   *  says the wrong thing. */
  const draft = useMemo<BatchDetail | null>(() => {
    if (!f.class_id) return null;
    return {
      id: "draft", created_at: new Date().toISOString(), created_by_name: null,
      card_count: null, status: "draft", cancel_reason: null, theme: f.theme ?? "indigo",
      valid_till: f.valid_till || null, center: f.center || null, issue_date: f.issue_date || null,
      exam_id: f.exam_id || null,
      exam_name: (exams.data ?? []).find((e) => e.id === f.exam_id)?.name ?? null,
      class_name: className(f.class_id), section_name: f.section_id ? sectionName(f.section_id) : null,
      roll_from: f.roll_from ? Number(f.roll_from) : null,
      roll_to: f.roll_to ? Number(f.roll_to) : null,
      class_id: f.class_id, section_id: f.section_id || null, student_ids: null,
    };
  }, [f, exams.data, classes.data, sections.data]); // eslint-disable-line react-hooks/exhaustive-deps

  function generate() {
    if (!f.class_id) { toast({ title: t("শ্রেণি নির্বাচন করুন", "Select a class"), variant: "error" }); return; }
    if (!isId && !f.exam_id) { toast({ title: t("পরীক্ষা নির্বাচন করুন", "Select an exam"), variant: "error" }); return; }
    const common = {
      class_id: f.class_id, section_id: f.section_id, roll_from: f.roll_from, roll_to: f.roll_to,
      theme: f.theme ?? "indigo", card_count: String(previewCount ?? 0),
    };
    const payload = isId
      ? { ...common, template: f.theme ?? "indigo", class_color: f.theme ?? "indigo", valid_till: f.valid_till,
          includes: { photo: true, blood: f.show_blood !== "off", qr: f.show_qr !== "off" } }
      : { ...common, exam_id: f.exam_id, center: f.center, issue_date: f.issue_date,
          includes: { seat: true, subjects: f.show_subjects !== "off" } };
    const onDone = () => { toast({ title: t("ব্যাচ তৈরি হয়েছে", "Batch created"), variant: "success" }); };
    const onErr = (e: unknown) => toast({ title: msg(e, { bn: "তৈরি ব্যর্থ", en: "Failed" }), variant: "error" });
    if (isId) createId.mutate(payload, { onSuccess: onDone, onError: onErr });
    else createAdmit.mutate(payload, { onSuccess: onDone, onError: onErr });
  }

  // Resolved roster for whatever the preview is showing — also the source of
  // `card_count`, so the number stored with the batch is the number printed.
  const spec: BatchSpec | null = preview
    ? { id: preview.id, class_id: preview.class_id, section_id: preview.section_id, roll_from: preview.roll_from, roll_to: preview.roll_to, student_ids: preview.student_ids }
    : draft
      ? { id: "draft", class_id: draft.class_id, section_id: draft.section_id, roll_from: draft.roll_from, roll_to: draft.roll_to, student_ids: null }
      : null;
  const roster = useBatchStudents(spec);
  const previewCount = roster.data?.length;

  const title = isId ? t("আইডি কার্ড", "ID Card") : t("প্রবেশপত্র", "Admit Card");

  return (
    <div className="flex flex-col gap-5 pb-6">
      <PageHeader
        crumbs={[{ label: t("ডকুমেন্টস", "Documents"), href: "/admin/certificate/template" }, { label: title }]}
        title={title}
        subtitle={isId ? t("শিক্ষার্থীর পরিচয়পত্র ব্যাচ তৈরি ও প্রিন্ট করুন", "Create and print a student ID-card batch") : t("পরীক্ষার প্রবেশপত্র ব্যাচ তৈরি ও প্রিন্ট করুন", "Create and print an exam admit-card batch")}
      />

      <div className="flex flex-col gap-4 rounded-2xl bg-surface p-6 shadow-e1">
        <h2 className="text-base font-semibold text-text-primary">{t("কনফিগারেশন", "Configuration")}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {!isId ? <Field label={t("পরীক্ষা", "Exam")} required><Select value={f.exam_id ?? ""} placeholder={t("নির্বাচন", "Select")} options={(exams.data ?? []).map((e) => ({ value: e.id, label: e.name }))} onChange={(e) => up("exam_id", e.target.value)} /></Field> : null}
          <Field label={t("শ্রেণি", "Class")} required><Select value={f.class_id ?? ""} placeholder={t("নির্বাচন", "Select")} options={opt(classes.data)} onChange={(e) => up("class_id", e.target.value)} /></Field>
          <Field label={t("শাখা", "Section")}><Select value={f.section_id ?? ""} placeholder={t("সকল শাখা", "All sections")} options={opt(sections.data)} onChange={(e) => up("section_id", e.target.value)} /></Field>
          <Field label={t("রোল (শুরু)", "Roll (from)")}><Input type="number" value={f.roll_from ?? ""} onChange={(e) => up("roll_from", e.target.value)} className="font-latin" /></Field>
          <Field label={t("রোল (শেষ)", "Roll (to)")}><Input type="number" value={f.roll_to ?? ""} onChange={(e) => up("roll_to", e.target.value)} className="font-latin" /></Field>
          {isId ? (
            <Field label={t("মেয়াদ", "Valid till")}><Input type="date" value={f.valid_till ?? ""} onChange={(e) => up("valid_till", e.target.value)} /></Field>
          ) : (
            <>
              <Field label={t("কেন্দ্র", "Centre")}><Input value={f.center ?? ""} onChange={(e) => up("center", e.target.value)} /></Field>
              <Field label={t("ইস্যু তারিখ", "Issue date")}><Input type="date" value={f.issue_date ?? ""} onChange={(e) => up("issue_date", e.target.value)} /></Field>
            </>
          )}
        </div>

        {/* Was two free-text inputs ("Card type" / "Class colour") whose values
            nothing ever read (A-7 point 3). A theme is a contract: the batch
            stores the key, the template renders it, the swatch shows it. */}
        <fieldset className="flex flex-col gap-2">
          <legend className="text-meta font-semibold text-text-secondary">{t("থিম", "Theme")}</legend>
          <div className="flex flex-wrap gap-2">
            {Object.values(THEMES).map((th) => (
              <button
                key={th.key}
                type="button"
                aria-pressed={f.theme === th.key}
                onClick={() => up("theme", th.key)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-meta",
                  f.theme === th.key ? "border-primary bg-primary-subtle font-semibold text-primary" : "border-border-default text-text-secondary hover:bg-sunken",
                )}
              >
                <span className="size-4 rounded-full border border-border-strong" style={{ background: th.accent }} aria-hidden />
                {t(th.bn, th.en)}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-4">
          {isId ? (
            <>
              <label className="flex items-center gap-2 text-meta text-text-secondary">
                <Checkbox checked={f.show_blood !== "off"} onChange={(e) => up("show_blood", e.target.checked ? "on" : "off")} />
                {t("রক্তের গ্রুপ দেখান", "Show blood group")}
              </label>
              <label className="flex items-center gap-2 text-meta text-text-secondary">
                <Checkbox checked={f.show_qr !== "off"} onChange={(e) => up("show_qr", e.target.checked ? "on" : "off")} />
                {t("QR কোড দেখান", "Show QR code")}
              </label>
            </>
          ) : (
            <label className="flex items-center gap-2 text-meta text-text-secondary">
              <Checkbox checked={f.show_subjects !== "off"} onChange={(e) => up("show_subjects", e.target.checked ? "on" : "off")} />
              {t("বিষয় ও তারিখ তালিকা দেখান", "Show subject & date table")}
            </label>
          )}
          <div className="flex-1" />
          <span className="text-meta text-text-muted">
            {draft
              ? roster.isLoading
                ? t("গণনা হচ্ছে…", "Counting…")
                : t(`${n(previewCount ?? 0)} জন শিক্ষার্থী মিলেছে`, `${n(previewCount ?? 0)} students matched`)
              : t("শ্রেণি নির্বাচন করুন", "Select a class")}
          </span>
          <Button variant="secondary" onClick={() => setPreview(draft)} disabled={!draft || !previewCount}>
            <Eye size={16} /> {t("প্রিভিউ", "Preview")}
          </Button>
          <Button variant="primary" onClick={generate} disabled={pending || !draft}>
            <Wand2 size={16} /> {pending ? t("তৈরি হচ্ছে…", "Creating…") : t("ব্যাচ তৈরি করুন", "Create batch")}
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border-default bg-surface shadow-e1">
        <div className="border-b border-border-default px-5 py-4">
          <p className="text-base font-semibold text-text-primary">{t("সাম্প্রতিক ব্যাচ", "Recent batches")}</p>
        </div>
        {loadingBatches ? (
          <div className="flex flex-col gap-2 p-5">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-11" />)}</div>
        ) : batches.length === 0 ? (
          <div className="p-5"><EmptyState icon={isId ? <IdCard size={22} /> : <Layers size={22} />} title={t("এখনও কোনো ব্যাচ নেই", "No batches yet")} /></div>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>{t("শ্রেণি ও শাখা", "Class & section")}</TH>
                {!isId ? <TH>{t("পরীক্ষা", "Exam")}</TH> : null}
                <TH>{t("রোল পরিসর", "Roll range")}</TH>
                <TH className="text-right">{t("সংখ্যা", "Count")}</TH>
                <TH>{t("তৈরি করেছেন", "Created by")}</TH>
                <TH>{t("অবস্থা", "Status")}</TH>
                <TH className="text-right">{t("কাজ", "Actions")}</TH>
              </TR>
            </THead>
            <TBody>
              {batches.map((b) => (
                <TR key={b.id}>
                  <TD>{b.class_name}{b.section_name ? ` · ${b.section_name}` : ""}</TD>
                  {!isId ? <TD>{b.exam_name ?? "—"}</TD> : null}
                  <TD className="tnum">{b.roll_from != null ? n(b.roll_from) : "—"} – {b.roll_to != null ? n(b.roll_to) : "—"}</TD>
                  <TD className="text-right tnum">{b.card_count != null ? n(b.card_count) : "—"}</TD>
                  <TD>
                    <span className="block">{b.created_by_name ?? "—"}</span>
                    <span className="block text-micro text-text-muted">{formatDateTime(b.created_at)}</span>
                  </TD>
                  <TD>
                    {b.status === "cancelled"
                      ? <Badge tone="danger" dot>{t("বাতিল", "Cancelled")}</Badge>
                      : <Badge tone="success" dot>{t("সক্রিয়", "Active")}</Badge>}
                    {b.cancel_reason ? <span className="mt-0.5 block text-micro text-text-muted">{b.cancel_reason}</span> : null}
                  </TD>
                  <TD>
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" onClick={() => setPreview(b)} disabled={b.status === "cancelled"}>
                        <Printer size={15} /> {t("পুনঃপ্রিন্ট", "Reprint")}
                      </Button>
                      <Button variant="ghost" onClick={() => setCancelling(b)} disabled={b.status === "cancelled"}>
                        <Ban size={15} /> {t("বাতিল", "Cancel")}
                      </Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>

      {preview ? (
        <BatchDocument
          kind={kind}
          batch={preview}
          layout={layout}
          onLayout={setLayout}
          onClose={() => setPreview(null)}
        />
      ) : null}

      {cancelling ? (
        <DangerConfirm
          open
          onClose={() => setCancelling(null)}
          title={t("ব্যাচ বাতিল করুন", "Cancel this batch")}
          description={t(
            "বাতিল করা ব্যাচ পুনঃপ্রিন্ট করা যাবে না। রেকর্ডটি ইতিহাসে থেকে যাবে — এটি মুছে ফেলা হয় না।",
            "A cancelled batch cannot be reprinted. The record stays in history — it is never deleted.",
          )}
          count={cancelling.card_count ?? 0}
          preview={`${cancelling.class_name}${cancelling.section_name ? ` · ${cancelling.section_name}` : ""}`}
          confirmLabel={t("ব্যাচ বাতিল করুন", "Cancel batch")}
          cancelLabel={t("ফিরে যান", "Go back")}
          typeToConfirmLabel={(phrase) => t(`নিশ্চিত করতে ${n(phrase)} টাইপ করুন`, `Type ${phrase} to confirm`)}
          reasonLabel={t("বাতিলের কারণ", "Reason for cancelling")}
          loading={cancel.isPending}
          onConfirm={(reason) => {
            cancel.mutate({ id: cancelling.id, reason: reason ?? "" }, {
              onSuccess: () => { toast({ title: t("ব্যাচ বাতিল হয়েছে", "Batch cancelled"), variant: "success" }); setCancelling(null); },
              onError: (e: unknown) => toast({ title: msg(e, { bn: "বাতিল ব্যর্থ", en: "Cancel failed" }), variant: "error" }),
            });
          }}
        />
      ) : null}
    </div>
  );
}

/** Resolves the roster + assets for one batch and renders the right template. */
function BatchDocument({
  kind, batch, layout, onLayout, onClose,
}: {
  kind: "id" | "admit";
  batch: BatchDetail;
  layout: CardLayout;
  onLayout: (v: CardLayout) => void;
  onClose: () => void;
}) {
  const { t, n } = useT();
  const isId = kind === "id";
  const spec: BatchSpec = {
    id: batch.id, class_id: batch.class_id, section_id: batch.section_id,
    roll_from: batch.roll_from, roll_to: batch.roll_to, student_ids: batch.student_ids,
  };
  const roster = useBatchStudents(spec);
  const students = useMemo(() => roster.data ?? [], [roster.data]);
  const letterhead = useLetterhead();
  const photos = useStudentPhotoUrls(useMemo(() => students.map((s) => s.photo_file_id), [students]));
  const seats = useSeatNumbers(isId ? null : batch.id === "draft" ? null : batch.id);
  const subjects = useExamSubjects(isId ? null : batch.exam_id, batch.class_id);
  const instructions = useSetting("admit_instruction", "certificate");

  const lines = useMemo(() => {
    const cfg = (instructions.data ?? {}) as Record<string, unknown>;
    return ["line1", "line2", "line3", "notes"]
      .map((k) => (typeof cfg[k] === "string" ? (cfg[k] as string).trim() : ""))
      .filter(Boolean);
  }, [instructions.data]);

  const title = `${isId ? t("আইডি কার্ড", "ID Card") : t("প্রবেশপত্র", "Admit Card")} — ${batch.class_name}${batch.section_name ? ` · ${batch.section_name}` : ""} (${n(students.length)})`;

  return (
    <DocumentPreview
      title={title}
      paper="a4"
      onClose={onClose}
      toolbar={
        isId ? (
          <Field label={t("বিন্যাস", "Layout")} className="w-36">
            <Select
              value={layout}
              options={LAYOUTS.map((l) => ({ value: l, label: l.replace("up", "-up") }))}
              onChange={(e) => onLayout(e.target.value as CardLayout)}
            />
          </Field>
        ) : null
      }
    >
      {roster.isLoading ? (
        <p className="p-8 text-meta text-text-muted">{t("লোড হচ্ছে…", "Loading…")}</p>
      ) : students.length === 0 ? (
        <p className="p-8 text-meta text-text-muted">{t("এই নির্বাচনে কোনো শিক্ষার্থী নেই।", "No students match this selection.")}</p>
      ) : isId ? (
        <IdCardSheets
          students={students}
          batch={{ theme: batch.theme, valid_till: batch.valid_till, class_name: batch.class_name, section_name: batch.section_name }}
          letterhead={letterhead.data}
          photoUrls={photos.data ?? {}}
          layout={layout}
        />
      ) : (
        <AdmitCardSheets
          students={students}
          batch={{ theme: batch.theme, exam_name: batch.exam_name, center: batch.center, issue_date: batch.issue_date, class_name: batch.class_name, section_name: batch.section_name }}
          letterhead={letterhead.data}
          photoUrls={photos.data ?? {}}
          seats={seats.data ?? {}}
          subjects={subjects.data ?? []}
          instructions={lines}
        />
      )}
    </DocumentPreview>
  );
}
