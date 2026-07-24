"use client";

import { useState } from "react";
import { Plus, Trash2, Pencil, Layers } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import { Field, Input, Button, EmptyState, ConfirmDialog, Modal, useToast, Breadcrumb } from "@/shared/ui";
import { useSubjectGroups, useSubjects, useUpsertGroup, useDeleteGroup } from "../../logic/hooks";

export function SubjectGroupScreen() {
  const { t, n, isBn } = useT();
  const toast = useToast();
  const groups = useSubjectGroups();
  const subjects = useSubjects();
  const upsert = useUpsertGroup();
  const del = useDeleteGroup();
  const [open, setOpen] = useState(false);
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [delId, setDelId] = useState<string | null>(null);

  function openNew() { setId(""); setName(""); setPicked(new Set()); setOpen(true); }
  function openEdit(g: NonNullable<typeof groups.data>[number]) { setId(g.id); setName(g.name); setPicked(new Set(g.subject_ids)); setOpen(true); }
  const toggle = (sid: string) => setPicked((p) => { const nx = new Set(p); if (nx.has(sid)) nx.delete(sid); else nx.add(sid); return nx; });

  function save() {
    if (!name.trim()) { toast({ title: t("গ্রুপের নাম আবশ্যক", "Group name required"), variant: "error" }); return; }
    upsert.mutate({ id: id || undefined, name, subject_ids: [...picked] }, {
      onSuccess: () => { toast({ title: t("গ্রুপ সংরক্ষিত", "Group saved"), variant: "success" }); setOpen(false); },
      onError: (e: unknown) => toast({ title: e instanceof Error ? e.message : t("সংরক্ষণ ব্যর্থ", "Save failed"), variant: "error" }),
    });
  }
  function remove() { if (!delId) return; const d = delId; setDelId(null); del.mutate(d, { onSuccess: () => toast({ title: t("মুছে ফেলা হয়েছে", "Deleted"), variant: "success" }), onError: (e: unknown) => toast({ title: e instanceof Error ? e.message : "Error", variant: "error" }) }); }

  const subs = subjects.data ?? [];
  const rows = groups.data ?? [];

  return (
    <div className="flex flex-col gap-5 pb-6">
      <div className="flex flex-wrap items-start gap-3">
        <header className="flex-1">
          <Breadcrumb items={[{ label: t("কোর সেটিংস", "Core Settings"), href: "/admin/core/basic-config" }, { label: t("বিষয় সেটিংস", "Subject Settings") }, { label: t("বিষয় গ্রুপ", "Subject Group") }]} />
          <h1 className="mt-1.5 text-h4 font-bold text-text-primary">{t("বিষয় গ্রুপ", "Subject Group")}</h1>
          <p className="mt-1 text-meta text-text-muted">{t("বিভাগভিত্তিক বিষয় গ্রুপ ও ঐচ্ছিক বিষয় ব্যবস্থাপনা", "Manage department-wise subject groups & electives")}</p>
        </header>
        <Button variant="primary" onClick={openNew}><Plus size={16} /> {t("নতুন গ্রুপ", "New group")}</Button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl bg-surface p-5 shadow-e3"><EmptyState icon={<Layers size={22} />} title={t("কোনো গ্রুপ নেই", "No groups yet")} /></div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {rows.map((g) => (
            <div key={g.id} className="flex flex-col gap-3.5 rounded-2xl bg-surface p-4.5 shadow-e3">
              <div className="flex items-center gap-3">
                <span className="grid size-10.5 shrink-0 place-items-center rounded-[10px] bg-primary-subtle text-lg font-bold text-primary">{g.name.slice(0, 1)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[16px] font-semibold text-text-primary">{g.name}</p>
                  <p className="text-[12px] text-text-muted">{t(`${n(g.subject_ids.length)}টি বিষয়`, `${n(g.subject_ids.length)} subjects`)}</p>
                </div>
                <button onClick={() => openEdit(g)} aria-label={t("সম্পাদনা", "Edit")} className="grid size-8.5 shrink-0 place-items-center rounded-lg border border-border-strong text-text-secondary hover:bg-sunken"><Pencil size={15} /></button>
                <button onClick={() => setDelId(g.id)} aria-label={t("মুছুন", "Delete")} className="grid size-8.5 shrink-0 place-items-center rounded-lg border border-border-strong text-danger-fg hover:bg-sunken"><Trash2 size={15} /></button>
              </div>
              {g.subject_ids.length > 0 ? (
                <>
                  <p className="text-[12.5px] font-semibold text-text-secondary">{t(`বিষয়সমূহ (${n(g.subject_ids.length)})`, `Subjects (${n(g.subject_ids.length)})`)}</p>
                  <div className="flex flex-wrap gap-2">
                    {subs.filter((s) => g.subject_ids.includes(s.id)).map((s) => (
                      <span key={s.id} className="rounded-full bg-sunken px-2.5 py-1.5 text-[12.5px] font-medium text-text-secondary">{isBn ? s.name_bn : s.name_en}</span>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-meta text-text-muted">{t("কোনো বিষয় নেই", "No subjects")}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={id ? t("গ্রুপ সম্পাদনা", "Edit group") : t("নতুন গ্রুপ", "New group")}
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>{t("বাতিল", "Cancel")}</Button><Button variant="primary" onClick={save} disabled={upsert.isPending}>{upsert.isPending ? t("সংরক্ষণ…", "Saving…") : t("সংরক্ষণ করুন", "Save")}</Button></>}
      >
        <div className="flex flex-col gap-4">
          <Field label={t("গ্রুপের নাম", "Group name")} required><Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("বিজ্ঞান", "Science")} /></Field>
          <div className="flex flex-col gap-2">
            <span className="text-meta font-medium text-text-secondary">{t("বিষয় নির্বাচন", "Select subjects")}</span>
            <div className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-lg border border-border-default p-2">
              {subs.length === 0 ? <p className="p-2 text-meta text-text-muted">{t("প্রথমে বিষয় যোগ করুন", "Add subjects first")}</p> : subs.map((s) => (
                <label key={s.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-meta text-text-secondary hover:bg-sunken">
                  <input type="checkbox" checked={picked.has(s.id)} onChange={() => toggle(s.id)} className="size-4 accent-primary" />
                  {isBn ? s.name_bn : s.name_en}
                </label>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!delId} onClose={() => setDelId(null)} onConfirm={remove} tone="danger" title={t("গ্রুপ মুছবেন?", "Delete group?")} confirmLabel={t("মুছুন", "Delete")} cancelLabel={t("বাতিল", "Cancel")} loading={del.isPending} />
    </div>
  );
}
