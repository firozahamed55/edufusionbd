"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Info, Upload } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import { FormCard, Field, Input, Textarea, Select, Skeleton, SaveBar, UnsavedDot, useToast, Button, PageHeader } from "@/shared/ui";
import { createClient } from "@/shared/services/supabase/client";
import { uploadInstitutionAsset, getAssetSignedUrl, AssetRejected } from "@/shared/lib/institutionAssets";
import { useUnsavedGuard } from "@/shared/lib/useUnsavedGuard";
import { useFieldErrors, fieldId } from "@/shared/lib/useFieldErrors";
import { startupSchema } from "../../logic/schemas";
import { useInstitution, useUpdateInstitution, useEducationBoards, useTeacherOptions } from "../../logic/hooks";
import { useErrorMessage } from "@/shared/services/errors";

const INSTITUTION_TYPES = [
  ["school", "স্কুল", "School"], ["college", "কলেজ", "College"], ["madrasha", "মাদ্রাসা", "Madrasha"], ["coaching", "কোচিং সেন্টার", "Coaching Center"],
] as const;
const MPO_STATUSES = [["mpo", "MPO ভুক্ত", "MPO enlisted"], ["non_mpo", "Non-MPO", "Non-MPO"]] as const;

/** What the caption has always claimed. It is now also what happens. */
const LOGO_MAX_BYTES = 1024 * 1024;

export function StartupScreen() {
  const { t, isBn } = useT();
  const msg = useErrorMessage();
  const toast = useToast();
  const inst = useInstitution();
  const boards = useEducationBoards();
  const teachers = useTeacherOptions();
  const update = useUpdateInstitution();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [f, setF] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);

  useEffect(() => {
    if (!inst.data) return;
    setF(fromInstitution(inst.data));
  }, [inst.data]);

  useEffect(() => {
    if (!inst.data?.logo_file_id) { setLogoUrl(null); return; }
    getAssetSignedUrl(createClient(), inst.data.logo_file_id).then(setLogoUrl).catch(() => setLogoUrl(null));
  }, [inst.data?.logo_file_id]);

  const set = (k: string, v: string) => { setF((p) => ({ ...p, [k]: v })); setDirty(true); };
  const headTeacher = teachers.data?.find((tc) => tc.id === f.head_teacher_id);

  // M-11: `dirty` was tracked for the SaveBar and the guard was never called,
  // so closing the tab mid-edit lost the data printed on every certificate.
  useUnsavedGuard(dirty);

  /**
   * S-2.1 — this screen validated nothing at all, and what it holds is what
   * every marksheet header and every board submission carries.
   *
   * Messages come from the schema in English and are translated here rather
   * than at the schema, because a zod message is a string baked at parse time
   * and `useT` is a hook. The map is exhaustive over the rules that exist; an
   * unmapped message falls through in English rather than disappearing.
   */
  const errors = useMemo(() => {
    const parsed = startupSchema.safeParse(f);
    if (parsed.success) return {};
    const out: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = typeof issue.path[0] === "string" ? issue.path[0] : null;
      if (key && out[key] === undefined) out[key] = translate(issue.message, t);
    }
    return out;
  }, [f, t]);

  const { bind, revealAll, clear: clearTouched } = useFieldErrors(errors);

  /** Screen order, top to bottom — what A-4's focus walks along. */
  const FIELD_ORDER = [
    "name_bn", "name_en", "eiin", "institution_code", "established_year",
    "phone", "email", "website", "address",
  ] as const;

  function onSave() {
    if (Object.keys(errors).length > 0) {
      revealAll(FIELD_ORDER);
      toast({ title: t("চিহ্নিত ফিল্ডগুলো ঠিক করুন", "Fix the highlighted fields"), variant: "error" });
      return;
    }
    update.mutate(
      {
        name_bn: f.name_bn, name_en: f.name_en, eiin: f.eiin, institution_type: f.institution_type, established_year: f.established_year,
        board_id: f.board_id, head_teacher_id: f.head_teacher_id, phone: f.phone, email: f.email, website: f.website, address: f.address,
        metadata: { institution_code: f.institution_code, mpo_status: f.mpo_status },
      },
      {
        onSuccess: () => { toast({ title: t("সংরক্ষিত হয়েছে", "Saved"), variant: "success" }); setDirty(false); clearTouched(); },
        onError: (e: unknown) => toast({ title: msg(e, { bn: "সংরক্ষণ ব্যর্থ", en: "Save failed" }), variant: "error" }),
      },
    );
  }
  function onReset() {
    if (!inst.data) return;
    setF(fromInstitution(inst.data));
    setDirty(false);
    clearTouched();
  }

  async function onLogoPick(file: File) {
    if (!inst.data) return;
    setLogoUploading(true);
    try {
      const fileId = await uploadInstitutionAsset(createClient(), {
        institutionId: inst.data.id,
        entity: "institution_logo",
        entityId: inst.data.id,
        file,
        maxBytes: LOGO_MAX_BYTES,
      });
      await update.mutateAsync({ logo_file_id: fileId });
      toast({ title: t("লোগো আপলোড হয়েছে", "Logo uploaded"), variant: "success" });
    } catch (e) {
      // The caption promised a limit and nothing enforced it (audit M-5). Now
      // it does, so say which rule was broken rather than "Upload failed".
      if (e instanceof AssetRejected) {
        toast({
          title: e.reason === "type"
            ? t("PNG, JPG বা SVG ফাইল দিন", "Choose a PNG, JPG or SVG file")
            : t("ছবিটি ১ MB এর বেশি — ছোট ছবি দিন", "That image is over 1 MB — pick a smaller one"),
          variant: "error",
        });
      } else {
        toast({ title: msg(e, { bn: "আপলোড ব্যর্থ", en: "Upload failed" }), variant: "error" });
      }
    } finally {
      setLogoUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 pb-6">
      {/* S-2.5 / M-10 — the only two screens in the module without breadcrumbs
          were this one and Basic Config, and both are the ones a new
          administrator meets first. */}
      <PageHeader
        crumbs={[{ label: t("কোর সেটিংস", "Core Settings"), href: "/admin/core/basic-config" }, { label: t("স্টার্টআপ", "StartUp") }]}
        title={t("স্টার্টআপ কনফিগারেশন", "Startup Configuration")}
        subtitle={t("প্রতিষ্ঠানের মৌলিক পরিচিতি ও প্রাথমিক সেটআপ", "The institution's core identity & initial setup")}
      />

      {inst.isLoading ? (
        <div className="flex flex-col gap-3 rounded-2xl bg-surface p-6 shadow-e1">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-11" />)}</div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-col gap-5">
            <FormCard title={t("প্রতিষ্ঠানের পরিচিতি", "Institution Identity")}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label={t("প্রতিষ্ঠানের নাম (বাংলা)", "Institution Name (Bangla)")} required {...bind("name_bn")}><Input id={fieldId("name_bn")} value={f.name_bn ?? ""} onChange={(e) => set("name_bn", e.target.value)} /></Field>
                <Field label={t("Institute Name (English)", "Institute Name (English)")} required {...bind("name_en")}><Input id={fieldId("name_en")} value={f.name_en ?? ""} onChange={(e) => set("name_en", e.target.value)} className="font-latin" /></Field>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label={t("EIIN", "EIIN")} required hint={t("৬ সংখ্যার EIIN", "6 digits")} {...bind("eiin")}><Input id={fieldId("eiin")} inputMode="numeric" value={f.eiin ?? ""} onChange={(e) => set("eiin", e.target.value)} className="font-latin" /></Field>
                <Field label={t("প্রতিষ্ঠান কোড", "Institution code")} {...bind("institution_code")}><Input id={fieldId("institution_code")} value={f.institution_code ?? ""} onChange={(e) => set("institution_code", e.target.value)} className="font-latin" placeholder="GVS-2026" /></Field>
                <Field label={t("ধরন", "Type")}>
                  <Select value={f.institution_type ?? ""} placeholder={t("নির্বাচন", "Select")} options={INSTITUTION_TYPES.map(([v, bn, en]) => ({ value: v, label: isBn ? bn : en }))} onChange={(e) => set("institution_type", e.target.value)} />
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label={t("প্রতিষ্ঠার সাল", "Founding year")} {...bind("established_year")}><Input id={fieldId("established_year")} type="number" value={f.established_year ?? ""} onChange={(e) => set("established_year", e.target.value)} className="font-latin" /></Field>
                <Field label={t("শিক্ষা বোর্ড", "Education board")}>
                  <Select value={f.board_id ?? ""} placeholder={boards.isLoading ? t("লোড হচ্ছে…", "Loading…") : t("নির্বাচন", "Select")} options={(boards.data ?? []).map((b) => ({ value: b.id, label: b.label }))} onChange={(e) => set("board_id", e.target.value)} />
                </Field>
                <Field label={t("MPO স্ট্যাটাস", "MPO status")}>
                  <Select value={f.mpo_status ?? ""} placeholder={t("নির্বাচন", "Select")} options={MPO_STATUSES.map(([v, bn, en]) => ({ value: v, label: isBn ? bn : en }))} onChange={(e) => set("mpo_status", e.target.value)} />
                </Field>
              </div>
            </FormCard>

            <FormCard title={t("যোগাযোগ", "Contact")}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label={t("মোবাইল", "Mobile")} {...bind("phone")}><Input id={fieldId("phone")} inputMode="numeric" placeholder="01XXXXXXXXX" value={f.phone ?? ""} onChange={(e) => set("phone", e.target.value)} className="font-latin" /></Field>
                <Field label={t("ইমেইল", "Email")} {...bind("email")}><Input id={fieldId("email")} type="email" value={f.email ?? ""} onChange={(e) => set("email", e.target.value)} className="font-latin" /></Field>
                <Field label={t("ওয়েবসাইট", "Website")} {...bind("website")}><Input id={fieldId("website")} inputMode="url" placeholder="https://" value={f.website ?? ""} onChange={(e) => set("website", e.target.value)} className="font-latin" /></Field>
              </div>
              <Field label={t("ঠিকানা", "Address")} {...bind("address")}><Textarea id={fieldId("address")} value={f.address ?? ""} onChange={(e) => set("address", e.target.value)} /></Field>
            </FormCard>

            <FormCard title={t("প্রধান শিক্ষকের তথ্য", "Head Teacher Info")}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label={t("শিক্ষক নির্বাচন", "Select teacher")}>
                  <Select value={f.head_teacher_id ?? ""} placeholder={teachers.isLoading ? t("লোড হচ্ছে…", "Loading…") : t("নির্বাচন", "Select")} options={(teachers.data ?? []).map((tc) => ({ value: tc.id, label: tc.label }))} onChange={(e) => set("head_teacher_id", e.target.value)} />
                </Field>
                <Field label={t("মোবাইল", "Mobile")}><Input value={headTeacher?.mobile ?? "—"} disabled className="font-latin" /></Field>
                <Field label={t("ইমেইল", "Email")}><Input value={headTeacher?.email ?? "—"} disabled className="font-latin" /></Field>
              </div>
            </FormCard>
          </div>

          <div className="flex flex-col gap-5">
            <FormCard title={t("প্রতিষ্ঠানের লোগো", "Institution Logo")} className="items-center text-center">
              <div className="flex w-full flex-col items-center gap-2.5 rounded-xl border border-dashed border-border-strong bg-sunken px-5 py-6">
                {logoUrl ? (
                  // Deliberately a raw <img>, not next/image — see
                  // SignatureScreen: signed URL into a private bucket, must not
                  // be cached by the public image optimizer.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt={t("প্রতিষ্ঠানের লোগো", "Institution logo")}
                    className="size-18 rounded-2xl object-cover"
                  />
                ) : (
                  <div className="grid size-18 place-items-center rounded-2xl bg-primary text-xl font-bold text-text-on-primary">
                    {(f.name_en || "?").slice(0, 3).toUpperCase()}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={logoUploading}
                  className="flex items-center gap-1.5 text-meta font-medium text-text-secondary hover:underline disabled:opacity-60"
                >
                  <Upload size={14} /> {logoUploading ? t("আপলোড হচ্ছে…", "Uploading…") : t("লোগো আপলোড করুন", "Upload logo")}
                </button>
                <p className="text-micro text-text-muted">{t("PNG, JPG বা SVG • সর্বোচ্চ ১ MB", "PNG, JPG or SVG • up to 1 MB")}</p>
                <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/svg+xml" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) onLogoPick(file); e.target.value = ""; }} />
              </div>
            </FormCard>

            <div className="flex gap-2 rounded-lg bg-primary-subtle px-3.5 py-3 text-primary">
              <Info size={16} className="mt-0.5 shrink-0" />
              <p className="text-meta leading-relaxed">{t("স্টার্টআপ তথ্য মার্কশিট, সার্টিফিকেট ও রিপোর্টের হেডারে ব্যবহৃত হবে।", "Startup info is used in the header of marksheets, certificates & reports.")}</p>
            </div>
          </div>
        </div>
      )}

      <SaveBar status={dirty ? <><UnsavedDot /> {t("অসংরক্ষিত পরিবর্তন", "Unsaved changes")}</> : null}>
        <Button variant="secondary" onClick={onReset} disabled={!dirty}>{t("রিসেট", "Reset")}</Button>
        <Button variant="primary" onClick={onSave} disabled={update.isPending || !dirty}>{update.isPending ? t("সংরক্ষণ হচ্ছে…", "Saving…") : t("সংরক্ষণ করুন", "Save")}</Button>
      </SaveBar>
    </div>
  );
}

/**
 * The institution row, as the strings the form holds.
 *
 * S-2.10: this block existed twice, verbatim, in a `useEffect` and in
 * `onReset`. Two copies of an initialiser is one copy away from a field that
 * loads correctly and resets to blank — the kind of drift nobody notices until
 * an operator resets and loses a value they never edited.
 */
function fromInstitution(inst: {
  name_bn: string; name_en: string; eiin: string | null; institution_type: string | null;
  established_year: number | null; board_id: string | null; phone: string | null; email: string | null;
  website: string | null; address: string | null; head_teacher_id: string | null;
  metadata: Record<string, unknown>;
}): Record<string, string> {
  const meta = inst.metadata ?? {};
  return {
    name_bn: inst.name_bn ?? "",
    name_en: inst.name_en ?? "",
    eiin: inst.eiin ?? "",
    institution_code: String(meta.institution_code ?? ""),
    institution_type: inst.institution_type ?? "",
    established_year: inst.established_year != null ? String(inst.established_year) : "",
    board_id: inst.board_id ?? "",
    mpo_status: String(meta.mpo_status ?? ""),
    phone: inst.phone ?? "",
    email: inst.email ?? "",
    website: inst.website ?? "",
    address: inst.address ?? "",
    head_teacher_id: inst.head_teacher_id ?? "",
  };
}

/**
 * Schema messages into the operator's language.
 *
 * A zod message is a string fixed when the schema is built, and `useT` is a
 * hook that cannot be called there. Rather than duplicate every rule per
 * locale, the English message is the key. An unmapped message falls through
 * untranslated, which is worse than Bangla and much better than blank.
 */
function translate(message: string, t: (bn: string, en: string) => string): string {
  const map: Record<string, [string, string]> = {
    "Bangla name is required": ["বাংলা নাম আবশ্যক", "Bangla name is required"],
    "English name is required": ["ইংরেজি নাম আবশ্যক", "English name is required"],
    "EIIN is exactly 6 digits": ["EIIN ঠিক ৬ সংখ্যার হতে হবে", "EIIN is exactly 6 digits"],
    "Enter a valid email address": ["সঠিক ইমেইল ঠিকানা দিন", "Enter a valid email address"],
    "Enter a full address including https://": ["https:// সহ সম্পূর্ণ ঠিকানা দিন", "Enter a full address including https://"],
    "The address must start with http:// or https://": ["ঠিকানাটি http:// বা https:// দিয়ে শুরু হতে হবে", "The address must start with http:// or https://"],
    "Enter an 11-digit mobile starting 013–019": ["০১৩–০১৯ দিয়ে শুরু ১১ সংখ্যার মোবাইল দিন", "Enter an 11-digit mobile starting 013-019"],
  };
  const hit = map[message];
  if (hit) return t(hit[0], hit[1]);
  // The founding-year message carries the current year, so it is built rather
  // than looked up.
  if (message.startsWith("Founding year must be between")) {
    const year = message.match(/\d{4}$/)?.[0] ?? "";
    return t(`প্রতিষ্ঠার সাল ১৮০০ থেকে ${year} এর মধ্যে হতে হবে`, message);
  }
  return message;
}
