"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Pencil, Award, X } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { Field, Input, Button, Badge, EmptyState, ConfirmDialog, Modal, useToast, Breadcrumb } from "@/shared/ui";
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

const REMARKS: Record<string, [string, string]> = {
  "A+": ["অসাধারণ", "Excellent"], A: ["উত্তম", "Very Good"], "A-": ["ভালো", "Good"],
  B: ["সন্তোষজনক", "Satisfactory"], C: ["মোটামুটি", "Fair"], D: ["উত্তীর্ণ", "Pass"], F: ["অকৃতকার্য", "Fail"],
};
function gradeTone(letter: string): "success" | "info" | "warning" | "danger" {
  const l = letter[0];
  if (l === "A") return "success";
  if (l === "B") return "info";
  if (l === "F") return "danger";
  return "warning";
}

export function GradingScreen() {
  const { t, n } = useT();
  const toast = useToast();
  const schemes = useGradeSchemes();
  const upsert = useUpsertScheme();
  const del = useDeleteScheme();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [scales, setScales] = useState<GradeScale[]>(DEFAULT_SCALES);
  const [delId, setDelId] = useState<string | null>(null);

  const rows = schemes.data ?? [];
  useEffect(() => { if (!activeId && schemes.data && schemes.data.length > 0) setActiveId(schemes.data[0].id); }, [schemes.data, activeId]);
  const active = rows.find((r) => r.id === activeId) ?? null;
  const sortedScales = useMemo(() => [...(active?.scales ?? [])].sort((a, b) => b.min_marks - a.min_marks), [active]);
  const passMark = sortedScales.filter((s) => s.gpa_point > 0).reduce((min, s) => Math.min(min, s.min_marks), Infinity);
  const maxGp = sortedScales.reduce((max, s) => Math.max(max, s.gpa_point), 0);

  function openNew() { setId(""); setName(""); setIsDefault(false); setScales(DEFAULT_SCALES); setOpen(true); }
  function openEdit() {
    if (!active) return;
    setId(active.id); setName(active.name); setIsDefault(active.is_default); setScales(active.scales.length ? active.scales : DEFAULT_SCALES);
    setOpen(true);
  }
  const setScale = (i: number, k: keyof GradeScale, v: string) => setScales((p) => p.map((r, j) => j === i ? { ...r, [k]: k === "grade_letter" ? v : Number(v) } : r));

  function save() {
    if (!name.trim()) { toast({ title: t("স্কিমের নাম আবশ্যক", "Scheme name required"), variant: "error" }); return; }
    upsert.mutate({ id: id || undefined, name, is_default: isDefault, scales }, {
      onSuccess: (savedId) => { toast({ title: t("গ্রেডিং স্কিম সংরক্ষিত", "Grading scheme saved"), variant: "success" }); setOpen(false); if (!id) setActiveId(savedId as string); },
      onError: (e: unknown) => toast({ title: e instanceof Error ? e.message : t("সংরক্ষণ ব্যর্থ", "Save failed"), variant: "error" }),
    });
  }
  function remove() {
    if (!delId) return; const target = delId; setDelId(null);
    del.mutate(target, {
      onSuccess: () => { toast({ title: t("মুছে ফেলা হয়েছে", "Deleted"), variant: "success" }); if (activeId === target) setActiveId(null); },
      onError: (e: unknown) => toast({ title: e instanceof Error ? e.message : "Error", variant: "error" }),
    });
  }

  return (
    <div className="flex flex-col gap-5 pb-6">
      <div className="flex flex-wrap items-start gap-3">
        <header className="flex-1">
          <Breadcrumb items={[{ label: t("কোর সেটিংস", "Core Settings"), href: "/admin/core/basic-config" }, { label: t("বিষয় সেটিংস", "Subject Settings") }, { label: t("গ্রেডিং স্কিম", "Grading Scheme") }]} />
          <h1 className="mt-1.5 text-h4 font-bold text-text-primary">{t("গ্রেডিং স্কিম", "Grading Scheme")}</h1>
          <p className="mt-1 text-meta text-text-muted">{t("GPA ৫.০ ভিত্তিক গ্রেড, নম্বর সীমা ও গ্রেড পয়েন্ট", "GPA-5 based grades, mark ranges & grade points")}</p>
        </header>
        <Button variant="primary" onClick={openNew}><Plus size={16} /> {t("নতুন স্কিম", "New scheme")}</Button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl bg-surface p-5 shadow-e3"><EmptyState icon={<Award size={22} />} title={t("কোনো স্কিম নেই", "No schemes yet")} /></div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2.5">
            <select value={activeId ?? ""} onChange={(e) => setActiveId(e.target.value)} className="h-10.5 rounded-lg border border-border-strong bg-surface px-3 text-meta font-medium text-text-secondary">
              {rows.map((r) => <option key={r.id} value={r.id}>{t(`স্কিম: ${r.name}`, `Scheme: ${r.name}`)}</option>)}
            </select>
            <div className="flex-1" />
            {active ? (
              <div className="flex items-center gap-2 rounded-lg bg-primary-subtle px-3 py-2 text-primary">
                <span className="text-[13px]">ⓘ</span>
                <span className="text-[12.5px] font-medium">{t(`পাস নম্বর: ${n(Number.isFinite(passMark) ? passMark : 0)} • সর্বোচ্চ GP: ${n(maxGp.toFixed(2))}`, `Pass mark: ${n(Number.isFinite(passMark) ? passMark : 0)} • Max GP: ${n(maxGp.toFixed(2))}`)}</span>
              </div>
            ) : null}
          </div>

          {active ? (
            <div className="overflow-hidden rounded-2xl bg-surface shadow-e3">
              <div className="flex items-center gap-3 bg-sunken px-5 py-3 text-[12.5px] font-semibold text-text-muted">
                <div className="w-30">{t("গ্রেড", "Grade")}</div>
                <div className="flex-1">{t("নম্বর সীমা", "Mark range")}</div>
                <div className="w-50">{t("গ্রেড পয়েন্ট (GP)", "Grade Point (GP)")}</div>
                <div className="flex-1">{t("মন্তব্য", "Remark")}</div>
                <div className="w-11" />
              </div>
              {sortedScales.map((s, i) => (
                <div key={i} className={cn("flex items-center gap-3 border-t border-border-default px-5 py-3.5", i % 2 === 1 && "bg-sunken")}>
                  <div className="w-30"><Badge tone={gradeTone(s.grade_letter)}>{s.grade_letter}</Badge></div>
                  <div className="flex-1 text-sm text-text-secondary tnum">{n(s.min_marks)} – {n(s.max_marks)}</div>
                  <div className="w-50 text-sm font-semibold text-text-primary tnum">{n(s.gpa_point.toFixed(2))}</div>
                  <div className="flex-1 text-meta text-text-secondary">{t(...(REMARKS[s.grade_letter] ?? ["—", "—"]))}</div>
                  <div className="flex w-11 justify-end">
                    <button onClick={openEdit} aria-label={t("সম্পাদনা", "Edit")} className="grid size-8 place-items-center rounded-md text-text-muted hover:bg-sunken"><Pencil size={15} /></button>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-border-default px-5 py-3">
                <span className="text-meta text-text-muted">{active.is_default ? <Badge tone="success">{t("ডিফল্ট স্কিম", "Default scheme")}</Badge> : null}</span>
                <button onClick={() => setDelId(active.id)} className="flex items-center gap-1.5 text-meta font-semibold text-danger-fg hover:underline"><Trash2 size={14} /> {t("স্কিম মুছুন", "Delete scheme")}</button>
              </div>
            </div>
          ) : null}
        </>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={id ? t("স্কিম সম্পাদনা", "Edit scheme") : t("নতুন গ্রেডিং স্কিম", "New grading scheme")}
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>{t("বাতিল", "Cancel")}</Button><Button variant="primary" onClick={save} disabled={upsert.isPending}>{upsert.isPending ? t("সংরক্ষণ…", "Saving…") : t("সংরক্ষণ করুন", "Save")}</Button></>}
      >
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
          <button onClick={() => setScales((p) => [...p, { grade_letter: "", gpa_point: 0, min_marks: 0, max_marks: 0 }])} className="flex items-center gap-1.5 self-start rounded-md px-1 py-0.5 text-meta font-semibold text-primary hover:underline"><Plus size={14} /> {t("গ্রেড যোগ করুন", "Add grade")}</button>
        </div>
      </Modal>

      <ConfirmDialog open={!!delId} onClose={() => setDelId(null)} onConfirm={remove} tone="danger" title={t("স্কিম মুছবেন?", "Delete scheme?")} confirmLabel={t("মুছুন", "Delete")} cancelLabel={t("বাতিল", "Cancel")} loading={del.isPending} />
    </div>
  );
}
