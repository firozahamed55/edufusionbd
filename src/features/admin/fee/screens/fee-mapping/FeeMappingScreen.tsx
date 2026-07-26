"use client";

import { useState } from "react";
import { Plus, List, CheckCircle2, PauseCircle, Tag, Trash2, type LucideIcon } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { Field, Select, Input, Button, Skeleton, EmptyState, ErrorState, ConfirmDialog, useToast, PageHeader } from "@/shared/ui";
import { useClasses, useStudentCategories } from "@/shared/services/lookups/hooks";
import type { Option } from "@/shared/services/lookups/api";
import { useFeeMappings, useFeeHeads, useUpsertFeeMapping, useDeleteFeeMapping } from "../../logic/hooks";
import { useErrorMessage } from "@/shared/services/errors";

const FREQUENCIES = [
  { value: "monthly", bn: "মাসিক", en: "Monthly" },
  { value: "one_time", bn: "এককালীন", en: "One-time" },
  { value: "exam", bn: "পরীক্ষা-ভিত্তিক", en: "Per-exam" },
  { value: "session", bn: "সেশন", en: "Session" },
  { value: "admission", bn: "ভর্তি", en: "Admission" },
];
const freqLabel = (v: string, isBn: boolean) => { const f = FREQUENCIES.find((x) => x.value === v); return f ? (isBn ? f.bn : f.en) : v; };

const EMPTY = { class_id: "", fee_head_id: "", student_category_id: "", amount: "", frequency: "monthly", is_active: true };

export function FeeMappingScreen() {
  const { t, n, isBn } = useT();
  const msg = useErrorMessage();
  const toast = useToast();
  const mappings = useFeeMappings();
  const classes = useClasses();
  const heads = useFeeHeads();
  const categories = useStudentCategories();
  const upsert = useUpsertFeeMapping();
  const del = useDeleteFeeMapping();
  const [f, setF] = useState({ ...EMPTY });
  const [delId, setDelId] = useState<string | null>(null);

  const opt = (list?: Option[]) => (list ?? []).map((o) => ({ value: o.value, label: isBn ? o.label_bn : o.label_en }));
  const rows = mappings.data ?? [];
  const activeCount = rows.filter((r) => r.is_active).length;

  function add() {
    if (!f.class_id || !f.fee_head_id || !f.amount) { toast({ title: t("শ্রেণি, ফি হেড ও পরিমাণ আবশ্যক", "Class, head & amount required"), variant: "error" }); return; }
    upsert.mutate(f, {
      onSuccess: () => { toast({ title: t("ম্যাপিং যোগ হয়েছে", "Mapping added"), variant: "success" }); setF({ ...EMPTY }); },
      onError: (e: unknown) => toast({ title: msg(e, { bn: "সংরক্ষণ ব্যর্থ", en: "Save failed" }), variant: "error" }),
    });
  }
  function toggle(id: string, is_active: boolean) {
    upsert.mutate({ id, class_id: "", fee_head_id: "", amount: "", frequency: "", is_active }, { onError: (e: unknown) => toast({ title: msg(e), variant: "error" }) });
  }
  function remove() {
    if (!delId) return; const id = delId; setDelId(null);
    del.mutate(id, {
      onSuccess: () => toast({ title: t("ম্যাপিং মুছে ফেলা হয়েছে", "Mapping deleted"), variant: "success" }),
      onError: (e: unknown) => toast({ title: msg(e, { bn: "মুছে ফেলা ব্যর্থ", en: "Delete failed" }), variant: "error" }),
    });
  }

  return (
    <div className="flex flex-col gap-5 pb-6">
      <PageHeader
        crumbs={[{ label: t("ফি ও অর্থ", "Fees & Finance"), href: "/admin/fee/quick-collection-list" }, { label: t("ফি ম্যাপিং", "Fee Mapping") }]}
        title={t("ফি ম্যাপিং", "Fee Mapping")}
        subtitle={t("শ্রেণি-ভিত্তিক ফি কাঠামো নির্ধারণ", "Define class-wise fee structure")}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SoftStat tone="primary" icon={List} value={n(rows.length)} label={t("মোট ম্যাপিং", "Total mappings")} />
        <SoftStat tone="success" icon={CheckCircle2} value={n(activeCount)} label={t("সক্রিয়", "Active")} />
        <SoftStat tone="warning" icon={PauseCircle} value={n(rows.length - activeCount)} label={t("নিষ্ক্রিয়", "Inactive")} />
        <SoftStat tone="info" icon={Tag} value={n((heads.data ?? []).length)} label={t("ফি হেড", "Fee heads")} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
        <div className="flex flex-col gap-4 rounded-2xl bg-surface p-5 shadow-e1">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-primary-subtle text-primary"><Plus size={16} /></span>
            <p className="text-base font-semibold text-text-primary">{t("নতুন ম্যাপিং যোগ করুন", "Add new mapping")}</p>
          </div>
          <Field label={t("শ্রেণি", "Class")} required><Select value={f.class_id} placeholder={t("নির্বাচন", "Select")} options={opt(classes.data)} onChange={(e) => setF((p) => ({ ...p, class_id: e.target.value }))} /></Field>
          <Field label={t("ফি হেড", "Fee head")} required><Select value={f.fee_head_id} placeholder={t("নির্বাচন", "Select")} options={(heads.data ?? []).map((h) => ({ value: h.id, label: h.name }))} onChange={(e) => setF((p) => ({ ...p, fee_head_id: e.target.value }))} /></Field>
          <Field label={t("ক্যাটাগরি (ঐচ্ছিক)", "Category (optional)")}><Select value={f.student_category_id} placeholder={t("সকল", "All")} options={opt(categories.data)} onChange={(e) => setF((p) => ({ ...p, student_category_id: e.target.value }))} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("পরিমাণ", "Amount")} required><Input type="number" min={0} value={f.amount} onChange={(e) => setF((p) => ({ ...p, amount: e.target.value }))} className="font-latin" /></Field>
            <Field label={t("ফ্রিকোয়েন্সি", "Frequency")}><Select value={f.frequency} options={FREQUENCIES.map((x) => ({ value: x.value, label: isBn ? x.bn : x.en }))} onChange={(e) => setF((p) => ({ ...p, frequency: e.target.value }))} /></Field>
          </div>
          <Button variant="primary" onClick={add} disabled={upsert.isPending}><Plus size={16} /> {upsert.isPending ? t("যোগ হচ্ছে…", "Adding…") : t("ম্যাপিং যোগ করুন", "Add mapping")}</Button>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-border-default bg-surface shadow-e1">
          <div className="min-w-160">
            <div className="flex items-center gap-3 border-b border-border-default px-5 py-4">
              <p className="flex-1 text-base font-semibold text-text-primary">{t("ফি ম্যাপিং তালিকা", "Fee mappings")}</p>
              <span className="text-meta font-semibold text-primary">{t("মোট", "Total")}: {n(rows.length)}</span>
            </div>
            {mappings.isLoading ? (
              <div className="flex flex-col gap-2 p-5">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : mappings.isError ? (
              <div className="p-5"><ErrorState title={t("লোড করা যায়নি", "Could not load")} /></div>
            ) : rows.length === 0 ? (
              <div className="p-5"><EmptyState icon={<Tag size={22} />} title={t("কোনো ম্যাপিং নেই", "No mappings yet")} /></div>
            ) : (
              <>
                <div className="flex items-center gap-3 border-b border-border-default px-5 py-3 text-meta font-semibold text-text-muted">
                  <div className="flex-1">{t("শ্রেণি", "Class")}</div>
                  <div className="w-27.5">{t("ফি হেড", "Head")}</div>
                  <div className="w-20 text-right">{t("পরিমাণ", "Amount")}</div>
                  <div className="w-30">{t("ফ্রিকোয়েন্সি", "Frequency")}</div>
                  <div className="w-17.5 text-center">{t("স্ট্যাটাস", "Status")}</div>
                  <div className="w-14 text-right">{t("অ্যাকশন", "Action")}</div>
                </div>
                {rows.map((m, i) => (
                  <div key={m.id} className={cn("flex items-center gap-3 px-5 py-3.5 border-b border-border-default last:border-0", i % 2 === 1 && "bg-sunken")}>
                    <div className="flex-1 text-meta font-medium text-text-primary">{isBn ? m.class_bn : m.class_en}{m.category ? ` · ${m.category}` : ""}</div>
                    <div className="w-27.5"><span className="inline-block rounded-full bg-primary-subtle px-2.5 py-1 text-xs font-semibold text-primary">{m.head}</span></div>
                    <div className="w-20 text-right text-sm font-bold text-text-primary tnum">৳{n(m.amount)}</div>
                    <div className="w-30 text-meta text-text-secondary">{freqLabel(m.frequency, isBn)}</div>
                    <div className="flex w-17.5 justify-center">
                      <button onClick={() => toggle(m.id, !m.is_active)} aria-label={t("টগল", "Toggle")} className={cn("relative inline-flex h-5 w-9 items-center rounded-full transition-colors", m.is_active ? "bg-primary" : "bg-border-strong")}>
                        <span className={cn("absolute size-4 rounded-full bg-white transition-all", m.is_active ? "right-0.5" : "left-0.5")} />
                      </button>
                    </div>
                    <div className="flex w-14 items-center justify-end">
                      <button onClick={() => setDelId(m.id)} aria-label={t("মুছুন", "Delete")} className="grid size-7 place-items-center rounded-md text-danger-fg hover:bg-sunken"><Trash2 size={15} /></button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog open={!!delId} onClose={() => setDelId(null)} onConfirm={remove} tone="danger"
        title={t("ম্যাপিং মুছবেন?", "Delete mapping?")} description={t("এই ফি ম্যাপিংটি স্থায়ীভাবে মুছে ফেলা হবে।", "This fee mapping will be permanently removed.")}
        confirmLabel={t("মুছুন", "Delete")} cancelLabel={t("বাতিল", "Cancel")} loading={del.isPending} />
    </div>
  );
}

const softTone = { primary: "bg-primary-subtle text-primary", success: "bg-success-bg text-success-fg", warning: "bg-warning-bg text-warning-fg", info: "bg-info-bg text-info-fg" } as const;
function SoftStat({ tone, icon: Icon, value, label }: { tone: keyof typeof softTone; icon: LucideIcon; value: string; label: string }) {
  return (
    <div className="flex items-center gap-3.5 rounded-2xl bg-surface p-5 shadow-e1">
      <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", softTone[tone])}><Icon size={22} /></span>
      <div className="min-w-0"><p className="text-2xl font-bold text-text-primary tnum">{value}</p><p className="truncate text-meta text-text-muted">{label}</p></div>
    </div>
  );
}
