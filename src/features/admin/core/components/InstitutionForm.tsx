"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import { FormCard, Field, Input, Button, Skeleton, useToast, Breadcrumb } from "@/shared/ui";
import { useInstitution, useUpdateInstitution } from "../logic/hooks";

const EMPTY = { name_bn: "", name_en: "", eiin: "", institution_type: "", address: "", phone: "", email: "", website: "", established_year: "" };

/** Institution profile editor — shared by Startup and Basic Settings. */
export function InstitutionForm({ mode }: { mode: "startup" | "basic" }) {
  const { t } = useT();
  const toast = useToast();
  const inst = useInstitution();
  const update = useUpdateInstitution();
  const [f, setF] = useState<Record<string, string>>({ ...EMPTY });
  const up = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (inst.data) setF({ ...EMPTY, ...Object.fromEntries(Object.entries(inst.data).map(([k, v]) => [k, v == null ? "" : String(v)])) });
  }, [inst.data]);

  function save() {
    if (!f.name_bn && !f.name_en) { toast({ title: t("প্রতিষ্ঠানের নাম আবশ্যক", "Institution name required"), variant: "error" }); return; }
    update.mutate(f, {
      onSuccess: () => toast({ title: t("সেটিংস সংরক্ষিত হয়েছে", "Settings saved"), variant: "success" }),
      onError: (e: unknown) => toast({ title: e instanceof Error ? e.message : t("সংরক্ষণ ব্যর্থ", "Save failed"), variant: "error" }),
    });
  }

  return (
    <div className="flex flex-col gap-5 pb-6">
      <header>
        <Breadcrumb
          items={[
            { label: t("কোর সেটিংস", "Core Settings"), href: "/admin/core/basic-config" },
            { label: mode === "startup" ? t("স্টার্টআপ", "Startup") : t("মৌলিক সেটিংস", "Basic Settings") },
          ]}
        />
        <h1 className="mt-1.5 text-h4 font-bold text-text-primary">{mode === "startup" ? t("প্রতিষ্ঠান স্টার্টআপ", "Institution Startup") : t("মৌলিক সেটিংস", "Basic Settings")}</h1>
        <p className="mt-1 text-meta text-text-muted">{t("প্রতিষ্ঠানের মৌলিক তথ্য নির্ধারণ ও হালনাগাদ করুন", "Configure the institution's core information")}</p>
      </header>

      {inst.isLoading ? (
        <div className="flex flex-col gap-3 rounded-2xl bg-surface p-6 shadow-e3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-11" />)}</div>
      ) : (
        <FormCard title={t("প্রতিষ্ঠানের তথ্য", "Institution Info")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label={t("নাম (বাংলা)", "Name (Bangla)")} required><Input value={f.name_bn} onChange={(e) => up("name_bn", e.target.value)} /></Field>
            <Field label={t("Name (English)", "Name (English)")} required><Input value={f.name_en} onChange={(e) => up("name_en", e.target.value)} className="font-latin" /></Field>
            <Field label={t("EIIN", "EIIN")}><Input value={f.eiin} onChange={(e) => up("eiin", e.target.value)} className="font-latin" /></Field>
            <Field label={t("প্রতিষ্ঠানের ধরন", "Institution type")}><Input value={f.institution_type} onChange={(e) => up("institution_type", e.target.value)} placeholder={t("স্কুল / কলেজ", "School / College")} /></Field>
            <Field label={t("স্থাপিত সাল", "Established year")}><Input type="number" value={f.established_year} onChange={(e) => up("established_year", e.target.value)} className="font-latin" /></Field>
            <Field label={t("ফোন", "Phone")}><Input value={f.phone} onChange={(e) => up("phone", e.target.value)} className="font-latin" /></Field>
            <Field label={t("ইমেইল", "Email")}><Input type="email" value={f.email} onChange={(e) => up("email", e.target.value)} className="font-latin" /></Field>
            <Field label={t("ওয়েবসাইট", "Website")}><Input value={f.website} onChange={(e) => up("website", e.target.value)} className="font-latin" /></Field>
            <Field label={t("ঠিকানা", "Address")} className="sm:col-span-2 lg:col-span-1"><Input value={f.address} onChange={(e) => up("address", e.target.value)} /></Field>
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="primary" onClick={save} disabled={update.isPending}><Save size={16} /> {update.isPending ? t("সংরক্ষণ হচ্ছে…", "Saving…") : t("সংরক্ষণ করুন", "Save")}</Button>
          </div>
        </FormCard>
      )}
    </div>
  );
}
