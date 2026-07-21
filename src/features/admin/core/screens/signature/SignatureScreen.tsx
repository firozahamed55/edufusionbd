"use client";

import { useState } from "react";
import { Plus, Trash2, PenTool } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { FormCard, Field, Input, Button, EmptyState, ConfirmDialog, useToast, Breadcrumb } from "@/shared/ui";
import { useSignatures, useUpsertSignature, useDeleteSignature } from "../../logic/hooks";

export function SignatureScreen() {
  const { t } = useT();
  const toast = useToast();
  const sigs = useSignatures();
  const upsert = useUpsertSignature();
  const del = useDeleteSignature();
  const [f, setF] = useState({ role_label: "", holder_name: "" });
  const [delId, setDelId] = useState<string | null>(null);

  function add() {
    if (!f.role_label.trim()) { toast({ title: t("পদবি আবশ্যক", "Role label required"), variant: "error" }); return; }
    upsert.mutate(f, { onSuccess: () => { toast({ title: t("স্বাক্ষর সংরক্ষিত", "Signature saved"), variant: "success" }); setF({ role_label: "", holder_name: "" }); }, onError: (e: unknown) => toast({ title: e instanceof Error ? e.message : t("সংরক্ষণ ব্যর্থ", "Save failed"), variant: "error" }) });
  }
  function remove() { if (!delId) return; const id = delId; setDelId(null); del.mutate(id, { onSuccess: () => toast({ title: t("মুছে ফেলা হয়েছে", "Deleted"), variant: "success" }), onError: (e: unknown) => toast({ title: e instanceof Error ? e.message : "Error", variant: "error" }) }); }

  const rows = sigs.data ?? [];
  return (
    <div className="flex flex-col gap-5 pb-6">
      <header>
        <Breadcrumb items={[{ label: t("কোর সেটিংস", "Core Settings"), href: "/admin/core/basic-config" }, { label: t("স্বাক্ষর", "Signatures") }]} />
        <h1 className="mt-1.5 text-h4 font-bold text-text-primary">{t("স্বাক্ষর ব্যবস্থাপনা", "Signature Management")}</h1>
        <p className="mt-1 text-meta text-text-muted">{t("সনদ ও রিপোর্টে ব্যবহৃত স্বাক্ষর নির্ধারণ করুন", "Define signatures used in certificates & reports")}</p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
        <FormCard title={t("নতুন স্বাক্ষর", "New signature")}>
          <div className="flex flex-col gap-4">
            <Field label={t("পদবি", "Role label")} required><Input value={f.role_label} onChange={(e) => setF((p) => ({ ...p, role_label: e.target.value }))} placeholder={t("প্রধান শিক্ষক", "Head Teacher")} /></Field>
            <Field label={t("নাম", "Holder name")}><Input value={f.holder_name} onChange={(e) => setF((p) => ({ ...p, holder_name: e.target.value }))} /></Field>
            <Button variant="primary" onClick={add} disabled={upsert.isPending}><Plus size={16} /> {upsert.isPending ? t("সংরক্ষণ…", "Saving…") : t("যোগ করুন", "Add")}</Button>
          </div>
        </FormCard>

        <div className="overflow-hidden rounded-2xl bg-surface shadow-e3">
          <div className="border-b border-border-default px-5 py-4"><p className="text-base font-semibold text-text-primary">{t("স্বাক্ষর তালিকা", "Signatures")}</p></div>
          {rows.length === 0 ? (
            <div className="p-5"><EmptyState icon={<PenTool size={22} />} title={t("কোনো স্বাক্ষর নেই", "No signatures yet")} /></div>
          ) : rows.map((r, i) => (
            <div key={r.id} className={cn("flex items-center gap-3 px-5 py-3.5 border-b border-border-default last:border-0", i % 2 === 1 && "bg-sunken")}>
              <div className="flex-1"><p className="text-sm font-medium text-text-primary">{r.role_label}</p>{r.holder_name ? <p className="text-[12.5px] text-text-muted">{r.holder_name}</p> : null}</div>
              <button onClick={() => setDelId(r.id)} aria-label={t("মুছুন", "Delete")} className="grid size-7 place-items-center rounded-md text-danger-fg hover:bg-sunken"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      </div>

      <ConfirmDialog open={!!delId} onClose={() => setDelId(null)} onConfirm={remove} tone="danger" title={t("স্বাক্ষর মুছবেন?", "Delete signature?")} confirmLabel={t("মুছুন", "Delete")} cancelLabel={t("বাতিল", "Cancel")} loading={del.isPending} />
    </div>
  );
}
