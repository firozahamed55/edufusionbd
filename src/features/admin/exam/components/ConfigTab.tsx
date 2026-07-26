"use client";

import { useEffect, useState } from "react";
import { FormCard, Field, Input, useToast } from "@/shared/ui";
import { useT } from "@/shared/i18n/useT";
import { ExamToggle, type SettingsTabId } from "./SettingsShell";
import { SettingsShell } from "./SettingsShell";
import { useExamConfig, useSaveExamConfig } from "../logic/hooks";
import { useErrorMessage } from "@/shared/services/errors";
import type { RpcPayload } from "@/shared/services/supabase/types";
import type { Json } from "@/shared/types/database.types";

type Bilingual = { bn: string; en: string };
export type ConfigField = { key: string; label: Bilingual; type: "text" | "number" | "toggle"; placeholder?: Bilingual };

/**
 * Live jsonb config tab (mark / marksheet / comment / date). Loads the config
 * singleton, renders typed fields, and persists via fn_save_exam_config.
 */
export function ConfigTab({ kind, active, cardTitle, fields }: {
  kind: "mark" | "comment" | "marksheet" | "date";
  active: SettingsTabId;
  cardTitle: Bilingual;
  fields: ConfigField[];
}) {
  const { t } = useT();
  const msg = useErrorMessage();
  const toast = useToast();
  const config = useExamConfig(kind);
  const save = useSaveExamConfig(kind);
  const [form, setForm] = useState<RpcPayload>({});

  useEffect(() => { if (config.data) setForm({ ...config.data }); }, [config.data]);

  const set = (k: string, v: Json) => setForm((p) => ({ ...p, [k]: v }));

  function onSave() {
    save.mutate(form, {
      onSuccess: () => toast({ title: t("কনফিগারেশন সংরক্ষিত হয়েছে", "Configuration saved"), variant: "success" }),
      onError: (e: unknown) => toast({ title: msg(e, { bn: "সংরক্ষণ ব্যর্থ", en: "Save failed" }), variant: "error" }),
    });
  }

  return (
    <SettingsShell active={active} onSave={onSave} onReset={() => setForm({ ...(config.data ?? {}) })} saving={save.isPending}>
      <FormCard title={t(cardTitle.bn, cardTitle.en)}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {fields.map((f) =>
            f.type === "toggle" ? (
              <label key={f.key} className="flex items-center justify-between gap-3 rounded-lg border border-border-default px-3 py-2.5">
                <span className="text-meta font-medium text-text-secondary">{t(f.label.bn, f.label.en)}</span>
                <button type="button" onClick={() => set(f.key, !form[f.key])}><ExamToggle on={Boolean(form[f.key])} /></button>
              </label>
            ) : (
              <Field key={f.key} label={t(f.label.bn, f.label.en)}>
                <Input type={f.type} value={form[f.key] == null ? "" : String(form[f.key])} placeholder={f.placeholder ? t(f.placeholder.bn, f.placeholder.en) : undefined}
                  onChange={(e) => set(f.key, f.type === "number" ? e.target.value : e.target.value)} />
              </Field>
            ),
          )}
        </div>
      </FormCard>
    </SettingsShell>
  );
}
