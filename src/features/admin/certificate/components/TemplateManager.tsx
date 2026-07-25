"use client";

import { useState } from "react";
import { Plus, Trash2, LayoutTemplate } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { Field, Select, Input, Button, EmptyState, ConfirmDialog, useToast, PageHeader } from "@/shared/ui";
import { useTemplates, useUpsertTemplate, useDeleteTemplate } from "../logic/hooks";
import { useErrorMessage } from "@/shared/services/errors";

const TYPES = [
  { value: "marksheet", bn: "মার্কশিট", en: "Marksheet" },
  { value: "admit", bn: "প্রবেশপত্র", en: "Admit card" },
  { value: "id", bn: "আইডি কার্ড", en: "ID card" },
  { value: "testimonial", bn: "প্রশংসাপত্র", en: "Testimonial" },
  { value: "transfer", bn: "স্থানান্তর সনদ", en: "Transfer" },
];
const typeLabel = (v: string, isBn: boolean) => TYPES.find((x) => x.value === v)?.[isBn ? "bn" : "en"] ?? v;

/** Certificate template manager — CRUD certificate_template (live). */
export function TemplateManager() {
  const { t, isBn } = useT();
  const msg = useErrorMessage();
  const toast = useToast();
  const templates = useTemplates();
  const upsert = useUpsertTemplate();
  const del = useDeleteTemplate();
  const [f, setF] = useState({ type: "id", header_text: "", footer_text: "", is_default: false });
  const [delId, setDelId] = useState<string | null>(null);

  function add() {
    upsert.mutate(
      { type: f.type, is_default: f.is_default, format_config: { header_text: f.header_text, footer_text: f.footer_text } },
      { onSuccess: () => { toast({ title: t("টেমপ্লেট সংরক্ষিত হয়েছে", "Template saved"), variant: "success" }); setF({ type: "id", header_text: "", footer_text: "", is_default: false }); },
        onError: (e: unknown) => toast({ title: msg(e, { bn: "সংরক্ষণ ব্যর্থ", en: "Save failed" }), variant: "error" }) },
    );
  }
  function remove() {
    if (!delId) return; const id = delId; setDelId(null);
    del.mutate(id, { onSuccess: () => toast({ title: t("টেমপ্লেট মুছে ফেলা হয়েছে", "Template deleted"), variant: "success" }), onError: (e: unknown) => toast({ title: msg(e, { bn: "মুছে ফেলা ব্যর্থ", en: "Delete failed" }), variant: "error" }) });
  }

  const rows = templates.data ?? [];
  return (
    <div className="flex flex-col gap-5 pb-6">
      <PageHeader
        crumbs={[{ label: t("সার্টিফিকেট", "Certificate"), href: "/admin/certificate/template" }, { label: t("টেমপ্লেট", "Templates") }]}
        title={t("সার্টিফিকেট টেমপ্লেট", "Certificate Templates")}
        subtitle={t("বিভিন্ন সনদের টেমপ্লেট কাঠামো নির্ধারণ করুন", "Define template formats for each certificate type")}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
        <div className="flex flex-col gap-4 rounded-2xl bg-surface p-5 shadow-e3">
          <div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-lg bg-primary-subtle text-primary"><Plus size={16} /></span><p className="text-base font-semibold text-text-primary">{t("নতুন টেমপ্লেট", "New template")}</p></div>
          <Field label={t("ধরন", "Type")} required><Select value={f.type} options={TYPES.map((x) => ({ value: x.value, label: isBn ? x.bn : x.en }))} onChange={(e) => setF((p) => ({ ...p, type: e.target.value }))} /></Field>
          <Field label={t("হেডার টেক্সট", "Header text")}><Input value={f.header_text} onChange={(e) => setF((p) => ({ ...p, header_text: e.target.value }))} placeholder={t("প্রতিষ্ঠানের নাম", "Institution name")} /></Field>
          <Field label={t("ফুটার টেক্সট", "Footer text")}><Input value={f.footer_text} onChange={(e) => setF((p) => ({ ...p, footer_text: e.target.value }))} /></Field>
          <label className="flex items-center gap-2 text-meta text-text-secondary"><input type="checkbox" checked={f.is_default} onChange={(e) => setF((p) => ({ ...p, is_default: e.target.checked }))} className="size-4 accent-primary" /> {t("ডিফল্ট টেমপ্লেট", "Default template")}</label>
          <Button variant="primary" onClick={add} disabled={upsert.isPending}><Plus size={16} /> {upsert.isPending ? t("সংরক্ষণ…", "Saving…") : t("টেমপ্লেট যোগ করুন", "Add template")}</Button>
        </div>

        <div className="overflow-hidden rounded-2xl bg-surface shadow-e3">
          <div className="flex items-center gap-3 border-b border-border-default px-5 py-4"><p className="flex-1 text-base font-semibold text-text-primary">{t("টেমপ্লেট তালিকা", "Templates")}</p></div>
          {templates.isLoading ? (
            <div className="p-5 text-meta text-text-muted">{t("লোড হচ্ছে…", "Loading…")}</div>
          ) : rows.length === 0 ? (
            <div className="p-5"><EmptyState icon={<LayoutTemplate size={22} />} title={t("কোনো টেমপ্লেট নেই", "No templates yet")} /></div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-border-default px-5 py-3 text-meta font-semibold text-text-muted">
                <div className="flex-1">{t("ধরন", "Type")}</div><div className="w-24 text-center">{t("ডিফল্ট", "Default")}</div><div className="w-14 text-right">{t("অ্যাকশন", "Action")}</div>
              </div>
              {rows.map((r, i) => (
                <div key={r.id} className={cn("flex items-center gap-3 px-5 py-3.5", i % 2 === 1 && "bg-sunken")}>
                  <div className="flex-1 text-sm font-medium text-text-primary">{typeLabel(r.type, isBn)}</div>
                  <div className="w-24 text-center">{r.is_default ? <span className="inline-block rounded-full bg-success-bg px-2.5 py-1 text-xs font-semibold text-success-fg">{t("হ্যাঁ", "Yes")}</span> : <span className="text-text-muted">—</span>}</div>
                  <div className="flex w-14 justify-end"><button onClick={() => setDelId(r.id)} aria-label={t("মুছুন", "Delete")} className="grid size-7 place-items-center rounded-md text-danger-fg hover:bg-sunken"><Trash2 size={15} /></button></div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      <ConfirmDialog open={!!delId} onClose={() => setDelId(null)} onConfirm={remove} tone="danger"
        title={t("টেমপ্লেট মুছবেন?", "Delete template?")} description={t("এই টেমপ্লেটটি স্থায়ীভাবে মুছে ফেলা হবে।", "This template will be permanently removed.")}
        confirmLabel={t("মুছুন", "Delete")} cancelLabel={t("বাতিল", "Cancel")} loading={del.isPending} />
    </div>
  );
}
