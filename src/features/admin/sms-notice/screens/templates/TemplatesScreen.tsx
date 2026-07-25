"use client";

import { useState } from "react";
import { Plus, Trash2, MessageSquareText } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { Field, Input, Select, Textarea, Button, EmptyState, ConfirmDialog, useToast, PageHeader } from "@/shared/ui";
import { useTemplates, useUpsertTemplate, useDeleteTemplate } from "../../logic/hooks";
import { useErrorMessage } from "@/shared/services/errors";

const CATEGORIES = [
  { value: "result", bn: "ফলাফল", en: "Result" },
  { value: "routine", bn: "রুটিন", en: "Routine" },
  { value: "fee_reminder", bn: "ফি রিমাইন্ডার", en: "Fee reminder" },
  { value: "attendance", bn: "উপস্থিতি", en: "Attendance" },
  { value: "holiday", bn: "ছুটি", en: "Holiday" },
  { value: "admission", bn: "ভর্তি", en: "Admission" },
];
const catLabel = (v: string | null, isBn: boolean) => CATEGORIES.find((x) => x.value === v)?.[isBn ? "bn" : "en"] ?? v ?? "—";

export function TemplatesScreen() {
  const { t, n, isBn } = useT();
  const msg = useErrorMessage();
  const toast = useToast();
  const templates = useTemplates();
  const upsert = useUpsertTemplate();
  const del = useDeleteTemplate();
  const [f, setF] = useState({ name: "", category: "result", body: "" });
  const [delId, setDelId] = useState<string | null>(null);

  function add() {
    if (!f.name.trim() || !f.body.trim()) { toast({ title: t("নাম ও বার্তা আবশ্যক", "Name & body required"), variant: "error" }); return; }
    upsert.mutate(f, { onSuccess: () => { toast({ title: t("টেমপ্লেট সংরক্ষিত", "Template saved"), variant: "success" }); setF({ name: "", category: "result", body: "" }); }, onError: (e: unknown) => toast({ title: msg(e, { bn: "সংরক্ষণ ব্যর্থ", en: "Save failed" }), variant: "error" }) });
  }
  function remove() { if (!delId) return; const id = delId; setDelId(null); del.mutate(id, { onSuccess: () => toast({ title: t("মুছে ফেলা হয়েছে", "Deleted"), variant: "success" }), onError: (e: unknown) => toast({ title: msg(e), variant: "error" }) }); }

  const rows = templates.data ?? [];
  return (
    <div className="flex flex-col gap-5 pb-6">
      <PageHeader
        crumbs={[{ label: t("SMS ও নোটিশ", "SMS & Notice"), href: "/admin/sms-notice/send" }, { label: t("টেমপ্লেট", "Templates") }]}
        title={t("SMS টেমপ্লেট", "SMS Templates")}
        subtitle={t("পুনঃব্যবহারযোগ্য বার্তা টেমপ্লেট তৈরি করুন", "Create reusable message templates")}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
        <div className="flex flex-col gap-4 rounded-2xl bg-surface p-5 shadow-e3">
          <div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-lg bg-primary-subtle text-primary"><Plus size={16} /></span><p className="text-base font-semibold text-text-primary">{t("নতুন টেমপ্লেট", "New template")}</p></div>
          <Field label={t("নাম", "Name")} required><Input value={f.name} onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))} /></Field>
          <Field label={t("ক্যাটাগরি", "Category")}><Select value={f.category} options={CATEGORIES.map((x) => ({ value: x.value, label: isBn ? x.bn : x.en }))} onChange={(e) => setF((p) => ({ ...p, category: e.target.value }))} /></Field>
          <Field label={t("বার্তা", "Body")} required><Textarea value={f.body} onChange={(e) => setF((p) => ({ ...p, body: e.target.value }))} /></Field>
          <Button variant="primary" onClick={add} disabled={upsert.isPending}><Plus size={16} /> {upsert.isPending ? t("সংরক্ষণ…", "Saving…") : t("যোগ করুন", "Add")}</Button>
        </div>

        <div className="overflow-hidden rounded-2xl bg-surface shadow-e3">
          <div className="border-b border-border-default px-5 py-4"><p className="text-base font-semibold text-text-primary">{t("টেমপ্লেট তালিকা", "Templates")}</p></div>
          {rows.length === 0 ? (
            <div className="p-5"><EmptyState icon={<MessageSquareText size={22} />} title={t("কোনো টেমপ্লেট নেই", "No templates yet")} /></div>
          ) : rows.map((r, i) => (
            <div key={r.id} className={cn("flex items-start gap-3 px-5 py-3.5 border-b border-border-default last:border-0", i % 2 === 1 && "bg-sunken")}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><p className="text-sm font-semibold text-text-primary">{r.name}</p><span className="rounded-full bg-primary-subtle px-2 py-0.5 text-micro font-semibold text-primary">{catLabel(r.category, isBn)}</span></div>
                <p className="mt-0.5 line-clamp-2 text-meta text-text-muted">{r.body}</p>
              </div>
              <span className="shrink-0 text-xs text-text-muted tnum">{n(r.usage_count)}×</span>
              <button onClick={() => setDelId(r.id)} aria-label={t("মুছুন", "Delete")} className="grid size-7 shrink-0 place-items-center rounded-md text-danger-fg hover:bg-sunken"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      </div>

      <ConfirmDialog open={!!delId} onClose={() => setDelId(null)} onConfirm={remove} tone="danger" title={t("টেমপ্লেট মুছবেন?", "Delete template?")} confirmLabel={t("মুছুন", "Delete")} cancelLabel={t("বাতিল", "Cancel")} loading={del.isPending} />
    </div>
  );
}
