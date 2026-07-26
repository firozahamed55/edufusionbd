"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import { Field, Input, Textarea, Button, useToast, PageHeader } from "@/shared/ui";
import { useSetting, useSaveSetting } from "../logic/hooks";
import { useErrorMessage } from "@/shared/services/errors";
import type { RpcPayload } from "@/shared/services/supabase/types";
import type { Json } from "@/shared/types/database.types";

type Bilingual = { bn: string; en: string };
export type SettingField = { key: string; label: Bilingual; type: "text" | "textarea" | "toggle" };

/** Generic institution-setting editor (admit-instruction, exam-essentials) via fn_save_setting. */
export function SettingConfig({ settingKey, scope, breadcrumb, title, subtitle, cardTitle, fields }: {
  settingKey: string; scope: string; breadcrumb: Bilingual; title: Bilingual; subtitle: Bilingual; cardTitle: Bilingual; fields: SettingField[];
}) {
  const { t } = useT();
  const msg = useErrorMessage();
  const toast = useToast();
  const config = useSetting(settingKey, scope);
  const save = useSaveSetting(settingKey, scope);
  const [form, setForm] = useState<RpcPayload>({});
  useEffect(() => { if (config.data) setForm({ ...config.data }); }, [config.data]);
  const set = (k: string, v: Json) => setForm((p) => ({ ...p, [k]: v }));

  function onSave() {
    save.mutate(form, {
      onSuccess: () => toast({ title: t("সংরক্ষিত হয়েছে", "Saved"), variant: "success" }),
      onError: (e: unknown) => toast({ title: msg(e, { bn: "সংরক্ষণ ব্যর্থ", en: "Save failed" }), variant: "error" }),
    });
  }

  return (
    <div className="flex flex-col gap-5 pb-6">
      <PageHeader
        crumbs={[{ label: t("সার্টিফিকেট", "Certificate"), href: "/admin/certificate/template" }, { label: t(breadcrumb.bn, breadcrumb.en) }]}
        title={t(title.bn, title.en)}
        subtitle={t(subtitle.bn, subtitle.en)}
      />

      <div className="flex flex-col gap-4 rounded-2xl bg-surface p-6 shadow-e3">
        <h2 className="text-base font-semibold text-text-primary">{t(cardTitle.bn, cardTitle.en)}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {fields.map((f) =>
            f.type === "toggle" ? (
              <label key={f.key} className="flex items-center justify-between gap-3 rounded-lg border border-border-default px-3 py-2.5">
                <span className="text-meta font-medium text-text-secondary">{t(f.label.bn, f.label.en)}</span>
                <button type="button" onClick={() => set(f.key, !form[f.key])} className={`relative inline-flex h-5 w-9 items-center rounded-full ${form[f.key] ? "bg-primary" : "bg-border-strong"}`}>
                  <span className={`absolute size-4 rounded-full bg-white ${form[f.key] ? "right-0.5" : "left-0.5"}`} />
                </button>
              </label>
            ) : f.type === "textarea" ? (
              <Field key={f.key} label={t(f.label.bn, f.label.en)} className="sm:col-span-2"><Textarea value={form[f.key] == null ? "" : String(form[f.key])} onChange={(e) => set(f.key, e.target.value)} /></Field>
            ) : (
              <Field key={f.key} label={t(f.label.bn, f.label.en)}><Input value={form[f.key] == null ? "" : String(form[f.key])} onChange={(e) => set(f.key, e.target.value)} /></Field>
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
