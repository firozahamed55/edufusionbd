"use client";

import { useState } from "react";
import { Plus, Trash2, Pencil, GraduationCap } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { FormCard, Field, Input, Button, EmptyState, ConfirmDialog, useToast } from "@/shared/ui";
import { useClasses, useUpsertClass, useDeleteClass } from "../../logic/hooks";

const EMPTY = { id: "", name_bn: "", name_en: "", numeric_level: "" };

export function ClassScreen() {
  const { t, n, isBn } = useT();
  const toast = useToast();
  const classes = useClasses();
  const upsert = useUpsertClass();
  const del = useDeleteClass();
  const [f, setF] = useState({ ...EMPTY });
  const [delId, setDelId] = useState<string | null>(null);
  const up = (k: keyof typeof EMPTY, v: string) => setF((p) => ({ ...p, [k]: v }));

  function save() {
    if (!f.name_bn && !f.name_en) { toast({ title: t("নাম আবশ্যক", "Name required"), variant: "error" }); return; }
    upsert.mutate(f, { onSuccess: () => { toast({ title: f.id ? t("শ্রেণি হালনাগাদ", "Class updated") : t("শ্রেণি যোগ হয়েছে", "Class added"), variant: "success" }); setF({ ...EMPTY }); }, onError: (e: unknown) => toast({ title: e instanceof Error ? e.message : t("সংরক্ষণ ব্যর্থ", "Save failed"), variant: "error" }) });
  }
  function remove() { if (!delId) return; const id = delId; setDelId(null); del.mutate(id, { onSuccess: () => toast({ title: t("মুছে ফেলা হয়েছে", "Deleted"), variant: "success" }), onError: (e: unknown) => toast({ title: e instanceof Error ? e.message : "Error", variant: "error" }) }); }

  const rows = classes.data ?? [];
  return (
    <div className="flex flex-col gap-5 pb-6">
      <header>
        <div className="flex items-center gap-1.5 text-[13px] text-text-muted"><span>{t("কোর সেটিংস", "Core Settings")}</span><span>›</span><span className="text-text-secondary">{t("শ্রেণি", "Classes")}</span></div>
        <h1 className="mt-1.5 text-[22px] font-bold text-text-primary">{t("শ্রেণি ব্যবস্থাপনা", "Class Management")}</h1>
        <p className="mt-1 text-[13px] text-text-muted">{t("প্রতিষ্ঠানের শ্রেণিসমূহ নির্ধারণ করুন", "Define the institution's classes")}</p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
        <FormCard title={f.id ? t("শ্রেণি সম্পাদনা", "Edit class") : t("নতুন শ্রেণি", "New class")}>
          <div className="flex flex-col gap-4">
            <Field label={t("নাম (বাংলা)", "Name (Bangla)")} required><Input value={f.name_bn} onChange={(e) => up("name_bn", e.target.value)} placeholder={t("৯ম শ্রেণি", "Class 9")} /></Field>
            <Field label={t("Name (English)", "Name (English)")} required><Input value={f.name_en} onChange={(e) => up("name_en", e.target.value)} className="font-latin" placeholder="Class 9" /></Field>
            <Field label={t("সংখ্যাসূচক স্তর", "Numeric level")}><Input type="number" value={f.numeric_level} onChange={(e) => up("numeric_level", e.target.value)} className="font-latin" placeholder="9" /></Field>
            <div className="flex gap-2">
              {f.id ? <Button variant="secondary" onClick={() => setF({ ...EMPTY })}>{t("বাতিল", "Cancel")}</Button> : null}
              <Button variant="primary" onClick={save} disabled={upsert.isPending} className="flex-1"><Plus size={16} /> {upsert.isPending ? t("সংরক্ষণ…", "Saving…") : f.id ? t("হালনাগাদ", "Update") : t("যোগ করুন", "Add")}</Button>
            </div>
          </div>
        </FormCard>

        <div className="overflow-hidden rounded-2xl bg-surface shadow-e3">
          <div className="border-b border-border-default px-5 py-4"><p className="text-base font-semibold text-text-primary">{t("শ্রেণি তালিকা", "Classes")}</p></div>
          {rows.length === 0 ? (
            <div className="p-5"><EmptyState icon={<GraduationCap size={22} />} title={t("কোনো শ্রেণি নেই", "No classes yet")} /></div>
          ) : rows.map((r, i) => (
            <div key={r.id} className={cn("flex items-center gap-3 px-5 py-3.5 border-b border-border-default last:border-0", i % 2 === 1 && "bg-sunken")}>
              <div className="w-16 text-[13px] font-semibold text-primary tnum">{r.numeric_level != null ? n(r.numeric_level) : "—"}</div>
              <div className="flex-1 text-sm font-medium text-text-primary">{isBn ? r.name_bn : r.name_en}</div>
              <button onClick={() => setF({ id: r.id, name_bn: r.name_bn, name_en: r.name_en, numeric_level: r.numeric_level != null ? String(r.numeric_level) : "" })} aria-label={t("সম্পাদনা", "Edit")} className="grid size-7 place-items-center rounded-md text-text-muted hover:bg-sunken"><Pencil size={15} /></button>
              <button onClick={() => setDelId(r.id)} aria-label={t("মুছুন", "Delete")} className="grid size-7 place-items-center rounded-md text-danger-fg hover:bg-sunken"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      </div>

      <ConfirmDialog open={!!delId} onClose={() => setDelId(null)} onConfirm={remove} tone="danger" title={t("শ্রেণি মুছবেন?", "Delete class?")} confirmLabel={t("মুছুন", "Delete")} cancelLabel={t("বাতিল", "Cancel")} loading={del.isPending} />
    </div>
  );
}
