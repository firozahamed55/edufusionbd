"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, Pencil, BookOpen, Search } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import {
  Field, Input, Select, Button, Badge, ConfirmDialog, Modal, useToast, PageHeader, Skeleton,
  Table, THead, TBody, TR, TH, TD, TableEmpty,
} from "@/shared/ui";
import { useSubjects, useUpsertSubject, useDeleteSubject, useClasses } from "../../logic/hooks";
import { useErrorMessage } from "@/shared/services/errors";

const EMPTY = { id: "", name_bn: "", name_en: "", code: "", type: "compulsory", full_marks: "100", pass_marks: "33", min_class_level: "", max_class_level: "", status: "active" };
const TYPES = [{ value: "compulsory", bn: "আবশ্যিক", en: "Compulsory" }, { value: "optional", bn: "ঐচ্ছিক", en: "Optional" }];

export function SubjectScreen() {
  const { t, n, isBn } = useT();
  const msg = useErrorMessage();
  const toast = useToast();
  const subjects = useSubjects();
  const classes = useClasses();
  const upsert = useUpsertSubject();
  const del = useDeleteSubject();
  const [f, setF] = useState({ ...EMPTY });
  const [open, setOpen] = useState(false);
  const [delId, setDelId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const up = (k: keyof typeof EMPTY, v: string) => setF((p) => ({ ...p, [k]: v }));

  const levels = useMemo(() => {
    const seen = new Set<number>();
    (classes.data ?? []).forEach((c) => { if (c.numeric_level != null) seen.add(c.numeric_level); });
    return [...seen].sort((a, b) => a - b);
  }, [classes.data]);
  const levelLabel = (lvl: number) => classes.data?.find((c) => c.numeric_level === lvl)?.[isBn ? "name_bn" : "name_en"] ?? String(lvl);

  function openNew() { setF({ ...EMPTY }); setOpen(true); }
  function openEdit(r: NonNullable<typeof subjects.data>[number]) {
    setF({
      id: r.id, name_bn: r.name_bn, name_en: r.name_en, code: r.code ?? "", type: r.type,
      full_marks: r.full_marks != null ? String(r.full_marks) : "", pass_marks: r.pass_marks != null ? String(r.pass_marks) : "",
      min_class_level: r.min_class_level != null ? String(r.min_class_level) : "", max_class_level: r.max_class_level != null ? String(r.max_class_level) : "",
      status: r.status ?? "active",
    });
    setOpen(true);
  }
  function save() {
    if (!f.name_bn && !f.name_en) { toast({ title: t("নাম আবশ্যক", "Name required"), variant: "error" }); return; }
    upsert.mutate(f, {
      onSuccess: () => { toast({ title: t("বিষয় সংরক্ষিত", "Subject saved"), variant: "success" }); setOpen(false); },
      onError: (e: unknown) => toast({ title: msg(e, { bn: "সংরক্ষণ ব্যর্থ", en: "Save failed" }), variant: "error" }),
    });
  }
  function remove() { if (!delId) return; const id = delId; setDelId(null); del.mutate(id, { onSuccess: () => toast({ title: t("মুছে ফেলা হয়েছে", "Deleted"), variant: "success" }), onError: (e: unknown) => toast({ title: msg(e), variant: "error" }) }); }

  const rows = (subjects.data ?? []).filter((r) => {
    if (typeFilter && r.type !== typeFilter) return false;
    if (q.trim()) {
      const term = q.trim().toLowerCase();
      if (!r.name_bn.includes(q.trim()) && !r.name_en.toLowerCase().includes(term) && !(r.code ?? "").toLowerCase().includes(term)) return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-5 pb-6">
      <div className="flex flex-wrap items-start gap-3">
        <PageHeader
          crumbs={[{ label: t("কোর সেটিংস", "Core Settings"), href: "/admin/core/basic-config" }, { label: t("বিষয় সেটিংস", "Subject Settings") }, { label: t("বিষয় তালিকা", "Subject List") }]}
          title={t("বিষয় তালিকা", "Subject List")}
          subtitle={t("সকল বিষয়, পূর্ণমান, পাস নম্বর ও ধরন ব্যবস্থাপনা", "Manage all subjects, full marks, pass marks & type")}
          className="flex-1"
        />
        <Button variant="primary" onClick={openNew}><Plus size={16} /> {t("নতুন বিষয়", "New subject")}</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative w-70 max-w-full">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("বিষয় খুঁজুন", "Search subjects")} className="h-10.5 w-full rounded-lg border border-border-strong bg-surface pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none" />
        </div>
        <div className="flex-1" />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="h-10.5 rounded-lg border border-border-strong bg-surface px-3 text-meta font-medium text-text-secondary">
          <option value="">{t("ধরন: সব", "Type: All")}</option>
          {TYPES.map((x) => <option key={x.value} value={x.value}>{isBn ? x.bn : x.en}</option>)}
        </select>
      </div>

      {/* Seven columns of subject data. It was nested flex <div>s with no
          <th scope>, so nothing told a screen reader which number was the
          full mark and which the pass mark (SRA A-0.7 / WCAG 1.3.1). */}
      <Table minWidth={1040}>
        <THead>
          <TR>
            <TH className="w-22.5">{t("কোড", "Code")}</TH>
            <TH>{t("বিষয়", "Subject")}</TH>
            <TH className="w-32.5">{t("ধরন", "Type")}</TH>
            <TH className="w-25 text-right">{t("পূর্ণমান", "Full marks")}</TH>
            <TH className="w-25 text-right">{t("পাস নম্বর", "Pass marks")}</TH>
            <TH className="w-40">{t("প্রযোজ্য শ্রেণি", "Applicable classes")}</TH>
            <TH className="w-27.5">{t("স্ট্যাটাস", "Status")}</TH>
            <TH className="w-20"><span className="sr-only">{t("অ্যাকশন", "Actions")}</span></TH>
          </TR>
        </THead>
        <TBody>
          {subjects.isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TR key={i}>{Array.from({ length: 8 }).map((__, j) => <TD key={j}><Skeleton className="h-5" /></TD>)}</TR>
            ))
          ) : rows.length === 0 ? (
            <TableEmpty colSpan={8} icon={<BookOpen size={22} />} title={t("কোনো বিষয় নেই", "No subjects yet")} />
          ) : rows.map((r) => (
            <TR key={r.id}>
              <TD><span className="rounded-md bg-sunken px-2 py-0.5 font-latin text-meta font-semibold text-text-secondary">{r.code ?? "—"}</span></TD>
              <TD>
                <p className="text-sm font-semibold text-text-primary">{isBn ? r.name_bn : r.name_en}</p>
                <p className="text-xs text-text-muted">{r.name_bn} — {r.name_en}</p>
              </TD>
              <TD className="text-meta text-text-secondary">{TYPES.find((x) => x.value === r.type)?.[isBn ? "bn" : "en"] ?? r.type}</TD>
              <TD className="text-right text-meta font-semibold text-text-primary tnum">{r.full_marks != null ? n(r.full_marks) : "—"}</TD>
              <TD className="text-right text-meta text-text-secondary tnum">{r.pass_marks != null ? n(r.pass_marks) : "—"}</TD>
              <TD className="text-meta text-text-secondary">
                {r.min_class_level != null && r.max_class_level != null ? t(`${levelLabel(r.min_class_level)} – ${levelLabel(r.max_class_level)}`, `${levelLabel(r.min_class_level)} – ${levelLabel(r.max_class_level)}`) : "—"}
              </TD>
              <TD><Badge tone={r.status === "inactive" ? "warning" : "success"}>{r.status === "inactive" ? t("নিষ্ক্রিয়", "Inactive") : t("সক্রিয়", "Active")}</Badge></TD>
              <TD>
                <div className="flex items-center justify-end gap-1">
                  <button onClick={() => openEdit(r)} aria-label={t(`${r.name_bn} সম্পাদনা`, `Edit ${r.name_en}`)} className="grid size-8 place-items-center rounded-md text-text-muted hover:bg-sunken"><Pencil size={15} /></button>
                  <button onClick={() => setDelId(r.id)} aria-label={t(`${r.name_bn} মুছুন`, `Delete ${r.name_en}`)} className="grid size-8 place-items-center rounded-md text-danger-fg hover:bg-sunken"><Trash2 size={15} /></button>
                </div>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>

      <Modal open={open} onClose={() => setOpen(false)} title={f.id ? t("বিষয় সম্পাদনা", "Edit subject") : t("নতুন বিষয়", "New subject")}
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>{t("বাতিল", "Cancel")}</Button><Button variant="primary" onClick={save} disabled={upsert.isPending}>{upsert.isPending ? t("সংরক্ষণ…", "Saving…") : t("সংরক্ষণ করুন", "Save")}</Button></>}
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("নাম (বাংলা)", "Name (Bangla)")} required><Input value={f.name_bn} onChange={(e) => up("name_bn", e.target.value)} /></Field>
            <Field label={t("Name (English)", "Name (English)")} required><Input value={f.name_en} onChange={(e) => up("name_en", e.target.value)} className="font-latin" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t("কোড", "Code")}><Input value={f.code} onChange={(e) => up("code", e.target.value)} className="font-latin" /></Field>
            <Field label={t("ধরন", "Type")}><Select value={f.type} options={TYPES.map((x) => ({ value: x.value, label: isBn ? x.bn : x.en }))} onChange={(e) => up("type", e.target.value)} /></Field>
            <Field label={t("পূর্ণ নম্বর", "Full marks")}><Input type="number" value={f.full_marks} onChange={(e) => up("full_marks", e.target.value)} className="font-latin" /></Field>
            <Field label={t("পাস নম্বর", "Pass marks")}><Input type="number" value={f.pass_marks} onChange={(e) => up("pass_marks", e.target.value)} className="font-latin" /></Field>
            <Field label={t("প্রযোজ্য শ্রেণি (শুরু)", "Applicable from")}>
              <Select value={f.min_class_level} placeholder={t("সব", "All")} options={levels.map((l) => ({ value: String(l), label: levelLabel(l) }))} onChange={(e) => up("min_class_level", e.target.value)} />
            </Field>
            <Field label={t("প্রযোজ্য শ্রেণি (শেষ)", "Applicable to")}>
              <Select value={f.max_class_level} placeholder={t("সব", "All")} options={levels.map((l) => ({ value: String(l), label: levelLabel(l) }))} onChange={(e) => up("max_class_level", e.target.value)} />
            </Field>
          </div>
          <label className="flex items-center justify-between rounded-lg border border-border-default px-3 py-2.5">
            <span className="text-meta font-medium text-text-secondary">{t("সক্রিয়", "Active")}</span>
            <button type="button" onClick={() => up("status", f.status === "active" ? "inactive" : "active")} className={cn("relative inline-flex h-5 w-9 items-center rounded-full transition-colors", f.status === "active" ? "bg-primary" : "bg-border-strong")}>
              <span className={cn("absolute size-4 rounded-full bg-white transition-all", f.status === "active" ? "right-0.5" : "left-0.5")} />
            </button>
          </label>
        </div>
      </Modal>

      <ConfirmDialog open={!!delId} onClose={() => setDelId(null)} onConfirm={remove} tone="danger" title={t("বিষয় মুছবেন?", "Delete subject?")} confirmLabel={t("মুছুন", "Delete")} cancelLabel={t("বাতিল", "Cancel")} loading={del.isPending} />
    </div>
  );
}
