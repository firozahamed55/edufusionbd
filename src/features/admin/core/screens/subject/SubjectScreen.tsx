"use client";

import { useState } from "react";
import { Plus, Trash2, Pencil, BookOpen } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { FormCard, Field, Input, Select, Button, EmptyState, ConfirmDialog, useToast } from "@/shared/ui";
import { useSubjects, useUpsertSubject, useDeleteSubject } from "../../logic/hooks";

const EMPTY = { id: "", name_bn: "", name_en: "", code: "", type: "compulsory", full_marks: "100", pass_marks: "33" };
const TYPES = [{ value: "compulsory", bn: "আবশ্যিক", en: "Compulsory" }, { value: "optional", bn: "ঐচ্ছিক", en: "Optional" }];

export function SubjectScreen() {
  const { t, n, isBn } = useT();
  const toast = useToast();
  const subjects = useSubjects();
  const upsert = useUpsertSubject();
  const del = useDeleteSubject();
  const [f, setF] = useState({ ...EMPTY });
  const [delId, setDelId] = useState<string | null>(null);
  const up = (k: keyof typeof EMPTY, v: string) => setF((p) => ({ ...p, [k]: v }));

  function save() {
    if (!f.name_bn && !f.name_en) { toast({ title: t("নাম আবশ্যক", "Name required"), variant: "error" }); return; }
    upsert.mutate(f, { onSuccess: () => { toast({ title: t("বিষয় সংরক্ষিত", "Subject saved"), variant: "success" }); setF({ ...EMPTY }); }, onError: (e: unknown) => toast({ title: e instanceof Error ? e.message : t("সংরক্ষণ ব্যর্থ", "Save failed"), variant: "error" }) });
  }
  function remove() { if (!delId) return; const id = delId; setDelId(null); del.mutate(id, { onSuccess: () => toast({ title: t("মুছে ফেলা হয়েছে", "Deleted"), variant: "success" }), onError: (e: unknown) => toast({ title: e instanceof Error ? e.message : "Error", variant: "error" }) }); }

  const rows = subjects.data ?? [];
  return (
    <div className="flex flex-col gap-5 pb-6">
      <header>
        <div className="flex items-center gap-1.5 text-meta text-text-muted"><span>{t("কোর সেটিংস", "Core Settings")}</span><span>›</span><span className="text-text-secondary">{t("বিষয়", "Subjects")}</span></div>
        <h1 className="mt-1.5 text-h4 font-bold text-text-primary">{t("বিষয় ব্যবস্থাপনা", "Subject Management")}</h1>
        <p className="mt-1 text-meta text-text-muted">{t("প্রতিষ্ঠানের বিষয়সমূহ নির্ধারণ করুন", "Define the institution's subjects")}</p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
        <FormCard title={f.id ? t("বিষয় সম্পাদনা", "Edit subject") : t("নতুন বিষয়", "New subject")}>
          <div className="flex flex-col gap-4">
            <Field label={t("নাম (বাংলা)", "Name (Bangla)")} required><Input value={f.name_bn} onChange={(e) => up("name_bn", e.target.value)} /></Field>
            <Field label={t("Name (English)", "Name (English)")} required><Input value={f.name_en} onChange={(e) => up("name_en", e.target.value)} className="font-latin" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("কোড", "Code")}><Input value={f.code} onChange={(e) => up("code", e.target.value)} className="font-latin" /></Field>
              <Field label={t("ধরন", "Type")}><Select value={f.type} options={TYPES.map((x) => ({ value: x.value, label: isBn ? x.bn : x.en }))} onChange={(e) => up("type", e.target.value)} /></Field>
              <Field label={t("পূর্ণ নম্বর", "Full marks")}><Input type="number" value={f.full_marks} onChange={(e) => up("full_marks", e.target.value)} className="font-latin" /></Field>
              <Field label={t("পাস নম্বর", "Pass marks")}><Input type="number" value={f.pass_marks} onChange={(e) => up("pass_marks", e.target.value)} className="font-latin" /></Field>
            </div>
            <div className="flex gap-2">
              {f.id ? <Button variant="secondary" onClick={() => setF({ ...EMPTY })}>{t("বাতিল", "Cancel")}</Button> : null}
              <Button variant="primary" onClick={save} disabled={upsert.isPending} className="flex-1"><Plus size={16} /> {upsert.isPending ? t("সংরক্ষণ…", "Saving…") : f.id ? t("হালনাগাদ", "Update") : t("যোগ করুন", "Add")}</Button>
            </div>
          </div>
        </FormCard>

        <div className="overflow-hidden rounded-2xl bg-surface shadow-e3">
          <div className="border-b border-border-default px-5 py-4"><p className="text-base font-semibold text-text-primary">{t("বিষয় তালিকা", "Subjects")}</p></div>
          {rows.length === 0 ? (
            <div className="p-5"><EmptyState icon={<BookOpen size={22} />} title={t("কোনো বিষয় নেই", "No subjects yet")} /></div>
          ) : rows.map((r, i) => (
            <div key={r.id} className={cn("flex items-center gap-3 px-5 py-3.5 border-b border-border-default last:border-0", i % 2 === 1 && "bg-sunken")}>
              <div className="flex-1 text-sm font-medium text-text-primary">{isBn ? r.name_bn : r.name_en}{r.code ? <span className="ml-2 font-latin text-xs text-text-muted">{r.code}</span> : null}</div>
              <span className="rounded-full bg-primary-subtle px-2 py-0.5 text-micro font-semibold text-primary">{TYPES.find((x) => x.value === r.type)?.[isBn ? "bn" : "en"] ?? r.type}</span>
              <div className="w-20 text-right text-meta text-text-secondary tnum">{r.full_marks != null ? n(r.full_marks) : "—"}</div>
              <button onClick={() => setF({ id: r.id, name_bn: r.name_bn, name_en: r.name_en, code: r.code ?? "", type: r.type, full_marks: r.full_marks != null ? String(r.full_marks) : "", pass_marks: r.pass_marks != null ? String(r.pass_marks) : "" })} aria-label={t("সম্পাদনা", "Edit")} className="grid size-7 place-items-center rounded-md text-text-muted hover:bg-sunken"><Pencil size={15} /></button>
              <button onClick={() => setDelId(r.id)} aria-label={t("মুছুন", "Delete")} className="grid size-7 place-items-center rounded-md text-danger-fg hover:bg-sunken"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      </div>

      <ConfirmDialog open={!!delId} onClose={() => setDelId(null)} onConfirm={remove} tone="danger" title={t("বিষয় মুছবেন?", "Delete subject?")} confirmLabel={t("মুছুন", "Delete")} cancelLabel={t("বাতিল", "Cancel")} loading={del.isPending} />
    </div>
  );
}
