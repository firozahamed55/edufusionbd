"use client";

import { useState } from "react";
import { Plus, Trash2, Pencil, Layers } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { FormCard, Field, Input, Button, EmptyState, ConfirmDialog, useToast } from "@/shared/ui";
import { useSubjectGroups, useSubjects, useUpsertGroup, useDeleteGroup } from "../../logic/hooks";

export function SubjectGroupScreen() {
  const { t, isBn } = useT();
  const toast = useToast();
  const groups = useSubjectGroups();
  const subjects = useSubjects();
  const upsert = useUpsertGroup();
  const del = useDeleteGroup();
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [delId, setDelId] = useState<string | null>(null);

  function reset() { setId(""); setName(""); setPicked(new Set()); }
  const toggle = (sid: string) => setPicked((p) => { const nx = new Set(p); if (nx.has(sid)) nx.delete(sid); else nx.add(sid); return nx; });

  function save() {
    if (!name.trim()) { toast({ title: t("গ্রুপের নাম আবশ্যক", "Group name required"), variant: "error" }); return; }
    upsert.mutate({ id: id || undefined, name, subject_ids: [...picked] }, {
      onSuccess: () => { toast({ title: t("গ্রুপ সংরক্ষিত", "Group saved"), variant: "success" }); reset(); },
      onError: (e: unknown) => toast({ title: e instanceof Error ? e.message : t("সংরক্ষণ ব্যর্থ", "Save failed"), variant: "error" }),
    });
  }
  function remove() { if (!delId) return; const d = delId; setDelId(null); del.mutate(d, { onSuccess: () => toast({ title: t("মুছে ফেলা হয়েছে", "Deleted"), variant: "success" }), onError: (e: unknown) => toast({ title: e instanceof Error ? e.message : "Error", variant: "error" }) }); }

  const subs = subjects.data ?? [];
  const rows = groups.data ?? [];
  return (
    <div className="flex flex-col gap-5 pb-6">
      <header>
        <div className="flex items-center gap-1.5 text-[13px] text-text-muted"><span>{t("কোর সেটিংস", "Core Settings")}</span><span>›</span><span className="text-text-secondary">{t("বিষয় গ্রুপ", "Subject Groups")}</span></div>
        <h1 className="mt-1.5 text-[22px] font-bold text-text-primary">{t("বিষয় গ্রুপ", "Subject Groups")}</h1>
        <p className="mt-1 text-[13px] text-text-muted">{t("বিভাগভিত্তিক বিষয় গ্রুপ তৈরি করুন (বিজ্ঞান, মানবিক…)", "Create subject groups (Science, Arts…)")}</p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[380px_1fr]">
        <FormCard title={id ? t("গ্রুপ সম্পাদনা", "Edit group") : t("নতুন গ্রুপ", "New group")}>
          <div className="flex flex-col gap-4">
            <Field label={t("গ্রুপের নাম", "Group name")} required><Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("বিজ্ঞান", "Science")} /></Field>
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-medium text-text-secondary">{t("বিষয় নির্বাচন", "Select subjects")}</span>
              <div className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-lg border border-border-default p-2">
                {subs.length === 0 ? <p className="p-2 text-[13px] text-text-muted">{t("প্রথমে বিষয় যোগ করুন", "Add subjects first")}</p> : subs.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-text-secondary hover:bg-sunken">
                    <input type="checkbox" checked={picked.has(s.id)} onChange={() => toggle(s.id)} className="size-4 accent-primary" />
                    {isBn ? s.name_bn : s.name_en}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              {id ? <Button variant="secondary" onClick={reset}>{t("বাতিল", "Cancel")}</Button> : null}
              <Button variant="primary" onClick={save} disabled={upsert.isPending} className="flex-1"><Plus size={16} /> {upsert.isPending ? t("সংরক্ষণ…", "Saving…") : id ? t("হালনাগাদ", "Update") : t("যোগ করুন", "Add")}</Button>
            </div>
          </div>
        </FormCard>

        <div className="overflow-hidden rounded-2xl bg-surface shadow-e3">
          <div className="border-b border-border-default px-5 py-4"><p className="text-base font-semibold text-text-primary">{t("গ্রুপ তালিকা", "Groups")}</p></div>
          {rows.length === 0 ? (
            <div className="p-5"><EmptyState icon={<Layers size={22} />} title={t("কোনো গ্রুপ নেই", "No groups yet")} /></div>
          ) : rows.map((r, i) => (
            <div key={r.id} className={cn("flex items-start gap-3 px-5 py-3.5 border-b border-border-default last:border-0", i % 2 === 1 && "bg-sunken")}>
              <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-text-primary">{r.name}</p><p className="mt-0.5 text-[12.5px] text-text-muted">{r.subject_names || t("কোনো বিষয় নেই", "No subjects")}</p></div>
              <button onClick={() => { setId(r.id); setName(r.name); setPicked(new Set(r.subject_ids)); }} aria-label={t("সম্পাদনা", "Edit")} className="grid size-7 shrink-0 place-items-center rounded-md text-text-muted hover:bg-sunken"><Pencil size={15} /></button>
              <button onClick={() => setDelId(r.id)} aria-label={t("মুছুন", "Delete")} className="grid size-7 shrink-0 place-items-center rounded-md text-danger-fg hover:bg-sunken"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      </div>

      <ConfirmDialog open={!!delId} onClose={() => setDelId(null)} onConfirm={remove} tone="danger" title={t("গ্রুপ মুছবেন?", "Delete group?")} confirmLabel={t("মুছুন", "Delete")} cancelLabel={t("বাতিল", "Cancel")} loading={del.isPending} />
    </div>
  );
}
