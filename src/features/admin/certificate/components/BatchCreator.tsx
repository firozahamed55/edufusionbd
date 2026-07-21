"use client";

import { useState } from "react";
import { Wand2, IdCard, Layers } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { Field, Input, Select, Button, EmptyState, useToast } from "@/shared/ui";
import { useClasses, useClassSectionsLookup } from "@/shared/services/lookups/hooks";
import type { Option } from "@/shared/services/lookups/api";
import { useCreateIdBatch, useCreateAdmitBatch, useIdCardBatches, useAdmitBatches, useExamOptions } from "../logic/hooks";

/** ID-card / Admit-card batch creator — live via fn_create_*_batch. */
export function BatchCreator({ kind }: { kind: "id" | "admit" }) {
  const isId = kind === "id";
  const { t, n, isBn } = useT();
  const toast = useToast();
  const [f, setF] = useState<Record<string, string>>({});
  const up = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  const classes = useClasses();
  const sections = useClassSectionsLookup();
  const exams = useExamOptions();
  const createId = useCreateIdBatch();
  const createAdmit = useCreateAdmitBatch();
  const idBatches = useIdCardBatches();
  const admitBatches = useAdmitBatches();
  const pending = createId.isPending || createAdmit.isPending;
  const list = isId ? idBatches.data ?? [] : admitBatches.data ?? [];

  const opt = (l?: Option[]) => (l ?? []).map((o) => ({ value: o.value, label: isBn ? o.label_bn : o.label_en }));

  function generate() {
    if (!f.class_id) { toast({ title: t("শ্রেণি নির্বাচন করুন", "Select a class"), variant: "error" }); return; }
    if (!isId && !f.exam_id) { toast({ title: t("পরীক্ষা নির্বাচন করুন", "Select an exam"), variant: "error" }); return; }
    const payload = isId
      ? { class_id: f.class_id, section_id: f.section_id, roll_from: f.roll_from, roll_to: f.roll_to, template: f.template, class_color: f.class_color, valid_till: f.valid_till, includes: { photo: true, blood: true, qr: true } }
      : { exam_id: f.exam_id, class_id: f.class_id, section_id: f.section_id, roll_from: f.roll_from, roll_to: f.roll_to, center: f.center, issue_date: f.issue_date, includes: { seat: true, subjects: true } };
    const onDone = () => { toast({ title: t("ব্যাচ তৈরি হয়েছে", "Batch created"), variant: "success" }); setF({}); };
    const onErr = (e: unknown) => toast({ title: e instanceof Error ? e.message : t("তৈরি ব্যর্থ", "Failed"), variant: "error" });
    if (isId) createId.mutate(payload, { onSuccess: onDone, onError: onErr });
    else createAdmit.mutate(payload, { onSuccess: onDone, onError: onErr });
  }

  const title = isId ? t("আইডি কার্ড", "ID Card") : t("প্রবেশপত্র", "Admit Card");
  return (
    <div className="flex flex-col gap-5 pb-6">
      <header>
        <div className="flex items-center gap-1.5 text-meta text-text-muted"><span>{t("সার্টিফিকেট", "Certificate")}</span><span>›</span><span className="text-text-secondary">{title}</span></div>
        <h1 className="mt-1.5 text-h4 font-bold text-text-primary">{title}</h1>
        <p className="mt-1 text-meta text-text-muted">{isId ? t("শিক্ষার্থীর পরিচয়পত্র ব্যাচ তৈরি করুন", "Create a student ID-card batch") : t("পরীক্ষার প্রবেশপত্র ব্যাচ তৈরি করুন", "Create an exam admit-card batch")}</p>
      </header>

      <div className="flex flex-col gap-4 rounded-2xl bg-surface p-6 shadow-e3">
        <h2 className="text-base font-semibold text-text-primary">{t("কনফিগারেশন", "Configuration")}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {!isId ? <Field label={t("পরীক্ষা", "Exam")} required><Select value={f.exam_id ?? ""} placeholder={t("নির্বাচন", "Select")} options={(exams.data ?? []).map((e) => ({ value: e.id, label: e.name }))} onChange={(e) => up("exam_id", e.target.value)} /></Field> : null}
          <Field label={t("শ্রেণি", "Class")} required><Select value={f.class_id ?? ""} placeholder={t("নির্বাচন", "Select")} options={opt(classes.data)} onChange={(e) => up("class_id", e.target.value)} /></Field>
          <Field label={t("শাখা", "Section")}><Select value={f.section_id ?? ""} placeholder={t("নির্বাচন", "Select")} options={opt(sections.data)} onChange={(e) => up("section_id", e.target.value)} /></Field>
          <Field label={t("রোল (শুরু)", "Roll (from)")}><Input type="number" value={f.roll_from ?? ""} onChange={(e) => up("roll_from", e.target.value)} className="font-latin" /></Field>
          <Field label={t("রোল (শেষ)", "Roll (to)")}><Input type="number" value={f.roll_to ?? ""} onChange={(e) => up("roll_to", e.target.value)} className="font-latin" /></Field>
          {isId ? (
            <>
              <Field label={t("কার্ডের ধরন", "Card type")}><Input value={f.template ?? ""} onChange={(e) => up("template", e.target.value)} placeholder={t("স্ট্যান্ডার্ড", "Standard")} /></Field>
              <Field label={t("শ্রেণি-রঙ", "Class color")}><Input value={f.class_color ?? ""} onChange={(e) => up("class_color", e.target.value)} placeholder={t("নীল", "Blue")} /></Field>
              <Field label={t("মেয়াদ", "Valid till")}><Input type="date" value={f.valid_till ?? ""} onChange={(e) => up("valid_till", e.target.value)} /></Field>
            </>
          ) : (
            <>
              <Field label={t("কেন্দ্র", "Center")}><Input value={f.center ?? ""} onChange={(e) => up("center", e.target.value)} /></Field>
              <Field label={t("ইস্যু তারিখ", "Issue date")}><Input type="date" value={f.issue_date ?? ""} onChange={(e) => up("issue_date", e.target.value)} /></Field>
            </>
          )}
        </div>
        <div className="flex justify-end gap-3">
          <button disabled className="rounded-lg border border-border-strong bg-surface px-4 py-2.5 text-sm font-medium text-text-muted opacity-60">{t("প্রিন্ট (শীঘ্রই)", "Print (soon)")}</button>
          <Button variant="primary" onClick={generate} disabled={pending}><Wand2 size={16} /> {pending ? t("তৈরি হচ্ছে…", "Creating…") : t("ব্যাচ তৈরি করুন", "Create batch")}</Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-surface shadow-e3">
        <div className="border-b border-border-default px-5 py-4"><p className="text-base font-semibold text-text-primary">{t("সাম্প্রতিক ব্যাচ", "Recent batches")}</p></div>
        {list.length === 0 ? (
          <div className="p-5"><EmptyState icon={isId ? <IdCard size={22} /> : <Layers size={22} />} title={t("এখনও কোনো ব্যাচ নেই", "No batches yet")} /></div>
        ) : (
          <>
            <div className="flex items-center gap-3 px-5 pt-4 pb-2 text-[12.5px] font-semibold text-text-muted">
              <div className="flex-1">{t("শ্রেণি ও শাখা", "Class & section")}</div>
              <div className="w-40">{t("রোল পরিসর", "Roll range")}</div>
            </div>
            {list.map((b, i) => (
              <div key={b.id} className={cn("flex items-center gap-3 px-5 py-3", i % 2 === 1 && "bg-sunken")}>
                <div className="flex-1 text-sm font-medium text-text-primary">{b.class_name}{b.section_name ? ` · ${b.section_name}` : ""}</div>
                <div className="w-40 text-meta text-text-secondary tnum">{b.roll_from != null ? n(b.roll_from) : "—"} – {b.roll_to != null ? n(b.roll_to) : "—"}</div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
