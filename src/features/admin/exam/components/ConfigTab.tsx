"use client";

import { useEffect, useState } from "react";
import { FormCard, Field, Input, useToast } from "@/shared/ui";
import { ExamToggle } from "./SettingsShell";
import { SettingsShell } from "./SettingsShell";
import { useExamConfig, useSaveExamConfig } from "../logic/hooks";

export type ConfigField = { key: string; label: string; type: "text" | "number" | "toggle"; placeholder?: string };

/**
 * Live jsonb config tab (mark / marksheet / comment / date). Loads the config
 * singleton, renders typed fields, and persists via fn_save_exam_config.
 */
export function ConfigTab({ kind, active, cardTitle, fields }: {
  kind: "mark" | "comment" | "marksheet" | "date";
  active: string;
  cardTitle: string;
  fields: ConfigField[];
}) {
  const toast = useToast();
  const config = useExamConfig(kind);
  const save = useSaveExamConfig(kind);
  const [form, setForm] = useState<Record<string, unknown>>({});

  useEffect(() => { if (config.data) setForm({ ...config.data }); }, [config.data]);

  const set = (k: string, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  function onSave() {
    save.mutate(form, {
      onSuccess: () => toast({ title: "কনফিগারেশন সংরক্ষিত হয়েছে", variant: "success" }),
      onError: (e: unknown) => toast({ title: e instanceof Error ? e.message : "সংরক্ষণ ব্যর্থ", variant: "error" }),
    });
  }

  return (
    <SettingsShell active={active} onSave={onSave} onReset={() => setForm({ ...(config.data ?? {}) })} saving={save.isPending}>
      <FormCard title={cardTitle}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {fields.map((f) =>
            f.type === "toggle" ? (
              <label key={f.key} className="flex items-center justify-between gap-3 rounded-lg border border-border-default px-3 py-2.5">
                <span className="text-meta font-medium text-text-secondary">{f.label}</span>
                <button type="button" onClick={() => set(f.key, !form[f.key])}><ExamToggle on={Boolean(form[f.key])} /></button>
              </label>
            ) : (
              <Field key={f.key} label={f.label}>
                <Input type={f.type} value={form[f.key] == null ? "" : String(form[f.key])} placeholder={f.placeholder}
                  onChange={(e) => set(f.key, f.type === "number" ? e.target.value : e.target.value)} />
              </Field>
            ),
          )}
        </div>
      </FormCard>
    </SettingsShell>
  );
}
