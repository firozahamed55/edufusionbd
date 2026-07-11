"use client";

import { useState } from "react";
import { Plus, Trash2, Megaphone } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { Field, Input, Select, Textarea, Button, EmptyState, ConfirmDialog, useToast } from "@/shared/ui";
import { useNotices, useUpsertNotice, useDeleteNotice } from "../../logic/hooks";

const AUDIENCES = [
  { value: "all_parents", bn: "সকল অভিভাবক", en: "All parents" },
  { value: "all_students", bn: "সকল শিক্ষার্থী", en: "All students" },
  { value: "class_wise", bn: "শ্রেণিভিত্তিক", en: "Class-wise" },
];
const STATUSES = [
  { value: "published", bn: "প্রকাশিত", en: "Published" },
  { value: "scheduled", bn: "নির্ধারিত", en: "Scheduled" },
  { value: "urgent", bn: "জরুরি", en: "Urgent" },
  { value: "draft", bn: "খসড়া", en: "Draft" },
];
const statusTone: Record<string, string> = { published: "bg-success-bg text-success-fg", scheduled: "bg-info-bg text-info-fg", urgent: "bg-danger-bg text-danger-fg", draft: "bg-sunken text-text-secondary" };
const lab = (arr: { value: string; bn: string; en: string }[], v: string | null, isBn: boolean) => arr.find((x) => x.value === v)?.[isBn ? "bn" : "en"] ?? v ?? "—";

export function NoticeBoardScreen() {
  const { t, n, isBn } = useT();
  const toast = useToast();
  const notices = useNotices();
  const upsert = useUpsertNotice();
  const del = useDeleteNotice();
  const [f, setF] = useState({ title: "", body: "", audience: "all_parents", event_date: "", status: "published" });
  const up = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const [delId, setDelId] = useState<string | null>(null);

  function add() {
    if (!f.title.trim()) { toast({ title: t("শিরোনাম আবশ্যক", "Title required"), variant: "error" }); return; }
    upsert.mutate(f, { onSuccess: () => { toast({ title: t("নোটিশ প্রকাশিত হয়েছে", "Notice published"), variant: "success" }); setF({ title: "", body: "", audience: "all_parents", event_date: "", status: "published" }); }, onError: (e: unknown) => toast({ title: e instanceof Error ? e.message : t("সংরক্ষণ ব্যর্থ", "Save failed"), variant: "error" }) });
  }
  function remove() { if (!delId) return; const id = delId; setDelId(null); del.mutate(id, { onSuccess: () => toast({ title: t("নোটিশ সরানো হয়েছে", "Notice archived"), variant: "success" }), onError: (e: unknown) => toast({ title: e instanceof Error ? e.message : "Error", variant: "error" }) }); }

  const rows = notices.data ?? [];
  return (
    <div className="flex flex-col gap-5 pb-6">
      <header>
        <div className="flex items-center gap-1.5 text-[13px] text-text-muted"><span>{t("SMS ও নোটিশ", "SMS & Notice")}</span><span>›</span><span className="text-text-secondary">{t("নোটিশ বোর্ড", "Notice Board")}</span></div>
        <h1 className="mt-1.5 text-[22px] font-bold text-text-primary">{t("নোটিশ বোর্ড", "Notice Board")}</h1>
        <p className="mt-1 text-[13px] text-text-muted">{t("নোটিশ প্রকাশ ও ব্যবস্থাপনা করুন", "Publish and manage notices")}</p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[380px_1fr]">
        <div className="flex flex-col gap-4 rounded-2xl bg-surface p-5 shadow-e3">
          <div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-lg bg-primary-subtle text-primary"><Plus size={16} /></span><p className="text-base font-semibold text-text-primary">{t("নতুন নোটিশ", "New notice")}</p></div>
          <Field label={t("শিরোনাম", "Title")} required><Input value={f.title} onChange={(e) => up("title", e.target.value)} /></Field>
          <Field label={t("বিবরণ", "Body")}><Textarea value={f.body} onChange={(e) => up("body", e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("প্রাপক", "Audience")}><Select value={f.audience} options={AUDIENCES.map((x) => ({ value: x.value, label: isBn ? x.bn : x.en }))} onChange={(e) => up("audience", e.target.value)} /></Field>
            <Field label={t("স্ট্যাটাস", "Status")}><Select value={f.status} options={STATUSES.map((x) => ({ value: x.value, label: isBn ? x.bn : x.en }))} onChange={(e) => up("status", e.target.value)} /></Field>
          </div>
          <Field label={t("ইভেন্ট তারিখ", "Event date")}><Input type="date" value={f.event_date} onChange={(e) => up("event_date", e.target.value)} /></Field>
          <Button variant="primary" onClick={add} disabled={upsert.isPending}><Plus size={16} /> {upsert.isPending ? t("প্রকাশ…", "Publishing…") : t("প্রকাশ করুন", "Publish")}</Button>
        </div>

        <div className="flex flex-col gap-3">
          {rows.length === 0 ? (
            <div className="rounded-2xl bg-surface p-5 shadow-e3"><EmptyState icon={<Megaphone size={22} />} title={t("কোনো নোটিশ নেই", "No notices yet")} /></div>
          ) : rows.map((r) => (
            <div key={r.id} className="flex items-start gap-3 rounded-2xl bg-surface p-5 shadow-e3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-text-primary">{r.title}</p><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", statusTone[r.status] ?? "bg-sunken text-text-secondary")}>{lab(STATUSES, r.status, isBn)}</span></div>
                {r.body ? <p className="mt-1 line-clamp-2 text-[13px] text-text-muted">{r.body}</p> : null}
                <p className="mt-1.5 text-[12px] text-text-muted">{lab(AUDIENCES, r.audience, isBn)}{r.event_date ? ` · ${n(new Date(r.event_date).toLocaleDateString(isBn ? "bn-BD" : "en-GB", { dateStyle: "medium" }))}` : ""}</p>
              </div>
              <button onClick={() => setDelId(r.id)} aria-label={t("মুছুন", "Delete")} className="grid size-8 shrink-0 place-items-center rounded-lg text-danger-fg hover:bg-sunken"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      </div>

      <ConfirmDialog open={!!delId} onClose={() => setDelId(null)} onConfirm={remove} tone="danger" title={t("নোটিশ সরাবেন?", "Archive notice?")} confirmLabel={t("সরান", "Archive")} cancelLabel={t("বাতিল", "Cancel")} loading={del.isPending} />
    </div>
  );
}
