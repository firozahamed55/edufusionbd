"use client";

import { useState } from "react";
import { Plus, Trash2, Pencil, Award, X } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { FormCard, Field, Input, Button, EmptyState, ConfirmDialog, useToast, Breadcrumb } from "@/shared/ui";
import { useGradeSchemes, useUpsertScheme, useDeleteScheme } from "../../logic/hooks";
import type { GradeScale } from "../../logic/api";

const DEFAULT_SCALES: GradeScale[] = [
  { grade_letter: "A+", gpa_point: 5, min_marks: 80, max_marks: 100 },
  { grade_letter: "A", gpa_point: 4, min_marks: 70, max_marks: 79 },
  { grade_letter: "A-", gpa_point: 3.5, min_marks: 60, max_marks: 69 },
  { grade_letter: "B", gpa_point: 3, min_marks: 50, max_marks: 59 },
  { grade_letter: "C", gpa_point: 2, min_marks: 40, max_marks: 49 },
  { grade_letter: "D", gpa_point: 1, min_marks: 33, max_marks: 39 },
  { grade_letter: "F", gpa_point: 0, min_marks: 0, max_marks: 32 },
];

export function GradingScreen() {
  const { t, n } = useT();
  const toast = useToast();
  const schemes = useGradeSchemes();
  const upsert = useUpsertScheme();
  const del = useDeleteScheme();
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [scales, setScales] = useState<GradeScale[]>(DEFAULT_SCALES);
  const [delId, setDelId] = useState<string | null>(null);

  function reset() { setId(""); setName(""); setIsDefault(false); setScales(DEFAULT_SCALES); }
  function edit(s: { id: string; name: string; is_default: boolean; scales: GradeScale[] }) { setId(s.id); setName(s.name); setIsDefault(s.is_default); setScales(s.scales.length ? s.scales : DEFAULT_SCALES); }
  const setScale = (i: number, k: keyof GradeScale, v: string) => setScales((p) => p.map((r, j) => j === i ? { ...r, [k]: k === "grade_letter" ? v : Number(v) } : r));

  function save() {
    if (!name.trim()) { toast({ title: t("স্কিমের নাম আবশ্যক", "Scheme name required"), variant: "error" }); return; }
    upsert.mutate({ id: id || undefined, name, is_default: isDefault, scales }, {
      onSuccess: () => { toast({ title: t("গ্রেডিং স্কিম সংরক্ষিত", "Grading scheme saved"), variant: "success" }); reset(); },
      onError: (e: unknown) => toast({ title: e instanceof Error ? e.message : t("সংরক্ষণ ব্যর্থ", "Save failed"), variant: "error" }),
    });
  }
  function remove() { if (!delId) return; const d = delId; setDelId(null); del.mutate(d, { onSuccess: () => toast({ title: t("মুছে ফেলা হয়েছে", "Deleted"), variant: "success" }), onError: (e: unknown) => toast({ title: e instanceof Error ? e.message : "Error", variant: "error" }) }); }

  const rows = schemes.data ?? [];
  return (
    <div className="flex flex-col gap-5 pb-6">
      <header>
        <Breadcrumb items={[{ label: t("কোর সেটিংস", "Core Settings"), href: "/admin/core/basic-config" }, { label: t("গ্রেডিং", "Grading") }]} />
        <h1 className="mt-1.5 text-h4 font-bold text-text-primary">{t("গ্রেডিং স্কিম", "Grading Schemes")}</h1>
        <p className="mt-1 text-meta text-text-muted">{t("গ্রেড, GPA ও নম্বর পরিসর নির্ধারণ করুন", "Define grades, GPA and mark ranges")}</p>
      </header>

      <FormCard title={id ? t("স্কিম সম্পাদনা", "Edit scheme") : t("নতুন গ্রেডিং স্কিম", "New grading scheme")}>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("স্কিমের নাম", "Scheme name")} required><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="GPA 5.0" /></Field>
            <label className="flex items-center gap-2 self-end pb-2.5 text-meta text-text-secondary"><input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="size-4 accent-primary" /> {t("ডিফল্ট স্কিম", "Default scheme")}</label>
          </div>
          <div className="overflow-x-auto rounded-xl border border-border-default">
            <div className="min-w-140">
              <div className="flex items-center gap-2 border-b border-border-default bg-sunken px-3 py-2 text-xs font-semibold text-text-muted">
                <div className="w-24">{t("গ্রেড", "Grade")}</div><div className="w-24">{t("GPA", "GPA")}</div><div className="w-28">{t("সর্বনিম্ন", "Min")}</div><div className="w-28">{t("সর্বোচ্চ", "Max")}</div><div className="w-10" />
              </div>
              {scales.map((s, i) => (
                <div key={i} className="flex items-center gap-2 border-b border-border-default px-3 py-1.5 last:border-0">
                  <Input value={s.grade_letter} onChange={(e) => setScale(i, "grade_letter", e.target.value)} className="h-8 w-24 font-latin" />
                  <Input type="number" value={String(s.gpa_point)} onChange={(e) => setScale(i, "gpa_point", e.target.value)} className="h-8 w-24 font-latin" />
                  <Input type="number" value={String(s.min_marks)} onChange={(e) => setScale(i, "min_marks", e.target.value)} className="h-8 w-28 font-latin" />
                  <Input type="number" value={String(s.max_marks)} onChange={(e) => setScale(i, "max_marks", e.target.value)} className="h-8 w-28 font-latin" />
                  <button onClick={() => setScales((p) => p.filter((_, j) => j !== i))} className="grid size-8 place-items-center rounded-md text-danger-fg hover:bg-sunken"><X size={15} /></button>
                </div>
              ))}
            </div>
          </div>
          <button onClick={() => setScales((p) => [...p, { grade_letter: "", gpa_point: 0, min_marks: 0, max_marks: 0 }])} className="flex items-center gap-1.5 self-start text-meta font-semibold text-primary"><Plus size={14} /> {t("গ্রেড যোগ করুন", "Add grade")}</button>
          <div className="flex justify-end gap-2">
            {id ? <Button variant="secondary" onClick={reset}>{t("বাতিল", "Cancel")}</Button> : null}
            <Button variant="primary" onClick={save} disabled={upsert.isPending}>{upsert.isPending ? t("সংরক্ষণ…", "Saving…") : id ? t("হালনাগাদ", "Update") : t("সংরক্ষণ করুন", "Save")}</Button>
          </div>
        </div>
      </FormCard>

      <div className="overflow-hidden rounded-2xl bg-surface shadow-e3">
        <div className="border-b border-border-default px-5 py-4"><p className="text-base font-semibold text-text-primary">{t("স্কিম তালিকা", "Schemes")}</p></div>
        {rows.length === 0 ? (
          <div className="p-5"><EmptyState icon={<Award size={22} />} title={t("কোনো স্কিম নেই", "No schemes yet")} /></div>
        ) : rows.map((r, i) => (
          <div key={r.id} className={cn("flex items-center gap-3 px-5 py-3.5 border-b border-border-default last:border-0", i % 2 === 1 && "bg-sunken")}>
            <div className="flex-1 text-sm font-medium text-text-primary">{r.name}{r.is_default ? <span className="ml-2 rounded-full bg-success-bg px-2 py-0.5 text-micro font-semibold text-success-fg">{t("ডিফল্ট", "Default")}</span> : null}</div>
            <span className="text-meta text-text-muted tnum">{n(r.scales.length)} {t("গ্রেড", "grades")}</span>
            <button onClick={() => edit(r)} aria-label={t("সম্পাদনা", "Edit")} className="grid size-7 place-items-center rounded-md text-text-muted hover:bg-sunken"><Pencil size={15} /></button>
            <button onClick={() => setDelId(r.id)} aria-label={t("মুছুন", "Delete")} className="grid size-7 place-items-center rounded-md text-danger-fg hover:bg-sunken"><Trash2 size={15} /></button>
          </div>
        ))}
      </div>

      <ConfirmDialog open={!!delId} onClose={() => setDelId(null)} onConfirm={remove} tone="danger" title={t("স্কিম মুছবেন?", "Delete scheme?")} confirmLabel={t("মুছুন", "Delete")} cancelLabel={t("বাতিল", "Cancel")} loading={del.isPending} />
    </div>
  );
}
