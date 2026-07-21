"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import { Field, Input, Textarea, Button, useToast } from "@/shared/ui";
import { useSetting, useSaveSetting } from "../logic/hooks";

export type SettingField = { key: string; label: string; type: "text" | "textarea" | "toggle" };

/** Generic institution-setting editor (admit-instruction, exam-essentials) via fn_save_setting. */
export function SettingConfig({ settingKey, scope, breadcrumb, title, subtitle, cardTitle, fields }: {
  settingKey: string; scope: string; breadcrumb: string; title: string; subtitle: string; cardTitle: string; fields: SettingField[];
}) {
  const { t } = useT();
  const toast = useToast();
  const config = useSetting(settingKey, scope);
  const save = useSaveSetting(settingKey, scope);
  const [form, setForm] = useState<Record<string, unknown>>({});
  useEffect(() => { if (config.data) setForm({ ...config.data }); }, [config.data]);
  const set = (k: string, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  function onSave() {
    save.mutate(form, {
      onSuccess: () => toast({ title: t("সংরক্ষিত হয়েছে", "Saved"), variant: "success" }),
      onError: (e: unknown) => toast({ title: e instanceof Error ? e.message : t("সংরক্ষণ ব্যর্থ", "Save failed"), variant: "error" }),
    });
  }

  return (
    <div className="flex flex-col gap-5 pb-6">
      <header>
        <div className="flex items-center gap-1.5 text-meta text-text-muted"><span>{t("সার্টিফিকেট", "Certificate")}</span><span>›</span><span className="text-text-secondary">{breadcrumb}</span></div>
        <h1 className="mt-1.5 text-h4 font-bold text-text-primary">{title}</h1>
        <p className="mt-1 text-meta text-text-muted">{subtitle}</p>
      </header>

      <div className="flex flex-col gap-4 rounded-2xl bg-surface p-6 shadow-e3">
        <h2 className="text-base font-semibold text-text-primary">{cardTitle}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {fields.map((f) =>
            f.type === "toggle" ? (
              <label key={f.key} className="flex items-center justify-between gap-3 rounded-lg border border-border-default px-3 py-2.5">
                <span className="text-meta font-medium text-text-secondary">{f.label}</span>
                <button type="button" onClick={() => set(f.key, !form[f.key])} className={`relative inline-flex h-5 w-9 items-center rounded-full ${form[f.key] ? "bg-primary" : "bg-border-strong"}`}>
                  <span className={`absolute size-4 rounded-full bg-white ${form[f.key] ? "right-0.5" : "left-0.5"}`} />
                </button>
              </label>
            ) : f.type === "textarea" ? (
              <Field key={f.key} label={f.label} className="sm:col-span-2"><Textarea value={form[f.key] == null ? "" : String(form[f.key])} onChange={(e) => set(f.key, e.target.value)} /></Field>
            ) : (
              <Field key={f.key} label={f.label}><Input value={form[f.key] == null ? "" : String(form[f.key])} onChange={(e) => set(f.key, e.target.value)} /></Field>
            ),
          )}
        </div>
        <div className="flex justify-end">
          <Button variant="primary" onClick={onSave} disabled={save.isPending}><Save size={16} /> {save.isPending ? t("সংরক্ষণ হচ্ছে…", "Saving…") : t("সংরক্ষণ করুন", "Save")}</Button>
        </div>
      </div>
    </div>
  );
}
