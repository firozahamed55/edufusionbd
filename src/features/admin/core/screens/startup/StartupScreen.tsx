"use client";

import { useEffect, useRef, useState } from "react";
import { Info, Upload } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import { FormCard, Field, Input, Textarea, Select, Skeleton, SaveBar, UnsavedDot, useToast } from "@/shared/ui";
import { createClient } from "@/shared/services/supabase/client";
import { uploadInstitutionAsset, getAssetSignedUrl, AssetRejected } from "@/shared/lib/institutionAssets";
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
    const meta = inst.data.metadata ?? {};
    setF({
      name_bn: inst.data.name_bn ?? "", name_en: inst.data.name_en ?? "", eiin: inst.data.eiin ?? "",
      institution_code: String(meta.institution_code ?? ""), institution_type: inst.data.institution_type ?? "",
      established_year: inst.data.established_year != null ? String(inst.data.established_year) : "",
      board_id: inst.data.board_id ?? "", mpo_status: String(meta.mpo_status ?? ""),
      phone: inst.data.phone ?? "", email: inst.data.email ?? "", website: inst.data.website ?? "", address: inst.data.address ?? "",
      head_teacher_id: inst.data.head_teacher_id ?? "",
    });
  }, [inst.data]);

  useEffect(() => {
    if (!inst.data?.logo_file_id) { setLogoUrl(null); return; }
    getAssetSignedUrl(createClient(), inst.data.logo_file_id).then(setLogoUrl).catch(() => setLogoUrl(null));
  }, [inst.data?.logo_file_id]);

  const set = (k: string, v: string) => { setF((p) => ({ ...p, [k]: v })); setDirty(true); };
  const headTeacher = teachers.data?.find((tc) => tc.id === f.head_teacher_id);

  function onSave() {
    update.mutate(
      {
        name_bn: f.name_bn, name_en: f.name_en, eiin: f.eiin, institution_type: f.institution_type, established_year: f.established_year,
        board_id: f.board_id, head_teacher_id: f.head_teacher_id, phone: f.phone, email: f.email, website: f.website, address: f.address,
        metadata: { institution_code: f.institution_code, mpo_status: f.mpo_status },
      },
      {
        onSuccess: () => { toast({ title: t("সংরক্ষিত হয়েছে", "Saved"), variant: "success" }); setDirty(false); },
        onError: (e: unknown) => toast({ title: msg(e, { bn: "সংরক্ষণ ব্যর্থ", en: "Save failed" }), variant: "error" }),
      },
    );
  }
  function onReset() {
    if (!inst.data) return;
    const meta = inst.data.metadata ?? {};
    setF({
      name_bn: inst.data.name_bn ?? "", name_en: inst.data.name_en ?? "", eiin: inst.data.eiin ?? "",
      institution_code: String(meta.institution_code ?? ""), institution_type: inst.data.institution_type ?? "",
      established_year: inst.data.established_year != null ? String(inst.data.established_year) : "",
      board_id: inst.data.board_id ?? "", mpo_status: String(meta.mpo_status ?? ""),
      phone: inst.data.phone ?? "", email: inst.data.email ?? "", website: inst.data.website ?? "", address: inst.data.address ?? "",
      head_teacher_id: inst.data.head_teacher_id ?? "",
    });
    setDirty(false);
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
      <header>
        <h1 className="mt-1.5 text-h4 font-bold text-text-primary">{t("স্টার্টআপ কনফিগারেশন", "Startup Configuration")}</h1>
        <p className="mt-1 text-meta text-text-muted">{t("প্রতিষ্ঠানের মৌলিক পরিচিতি ও প্রাথমিক সেটআপ", "The institution's core identity & initial setup")}</p>
      </header>

      {inst.isLoading ? (
        <div className="flex flex-col gap-3 rounded-2xl bg-surface p-6 shadow-e1">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-11" />)}</div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-col gap-5">
            <FormCard title={t("প্রতিষ্ঠানের পরিচিতি", "Institution Identity")}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label={t("প্রতিষ্ঠানের নাম (বাংলা)", "Institution Name (Bangla)")} required><Input value={f.name_bn ?? ""} onChange={(e) => set("name_bn", e.target.value)} /></Field>
                <Field label={t("Institute Name (English)", "Institute Name (English)")} required><Input value={f.name_en ?? ""} onChange={(e) => set("name_en", e.target.value)} className="font-latin" /></Field>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label={t("EIIN", "EIIN")} required><Input value={f.eiin ?? ""} onChange={(e) => set("eiin", e.target.value)} className="font-latin" /></Field>
                <Field label={t("প্রতিষ্ঠান কোড", "Institution code")}><Input value={f.institution_code ?? ""} onChange={(e) => set("institution_code", e.target.value)} className="font-latin" placeholder="GVS-2026" /></Field>
                <Field label={t("ধরন", "Type")}>
                  <Select value={f.institution_type ?? ""} placeholder={t("নির্বাচন", "Select")} options={INSTITUTION_TYPES.map(([v, bn, en]) => ({ value: v, label: isBn ? bn : en }))} onChange={(e) => set("institution_type", e.target.value)} />
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label={t("প্রতিষ্ঠার সাল", "Founding year")}><Input type="number" value={f.established_year ?? ""} onChange={(e) => set("established_year", e.target.value)} className="font-latin" /></Field>
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
                <Field label={t("মোবাইল", "Mobile")}><Input value={f.phone ?? ""} onChange={(e) => set("phone", e.target.value)} className="font-latin" /></Field>
                <Field label={t("ইমেইল", "Email")}><Input type="email" value={f.email ?? ""} onChange={(e) => set("email", e.target.value)} className="font-latin" /></Field>
                <Field label={t("ওয়েবসাইট", "Website")}><Input value={f.website ?? ""} onChange={(e) => set("website", e.target.value)} className="font-latin" /></Field>
              </div>
              <Field label={t("ঠিকানা", "Address")}><Textarea value={f.address ?? ""} onChange={(e) => set("address", e.target.value)} /></Field>
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
        <button type="button" onClick={onReset} disabled={!dirty} className="rounded-lg border border-border-strong bg-surface px-4 py-2.5 text-sm font-semibold text-text-secondary hover:bg-sunken disabled:opacity-50">{t("রিসেট", "Reset")}</button>
        <button type="button" onClick={onSave} disabled={update.isPending || !dirty} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-text-on-primary hover:bg-primary-hover disabled:opacity-50">{update.isPending ? t("সংরক্ষণ হচ্ছে…", "Saving…") : t("সংরক্ষণ করুন", "Save")}</button>
      </SaveBar>
    </div>
  );
}
