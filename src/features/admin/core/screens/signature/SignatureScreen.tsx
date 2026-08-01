"use client";

import { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import { Field, Input, useToast, PageHeader } from "@/shared/ui";
import { createClient } from "@/shared/services/supabase/client";
import { uploadInstitutionAsset, getAssetSignedUrl, AssetRejected } from "@/shared/lib/institutionAssets";
import { useSignatures, useUpsertSignature, useInstitution } from "../../logic/hooks";
import { useErrorMessage } from "@/shared/services/errors";

const ROLES = [
  { key: "head_teacher", bn: "প্রধান শিক্ষক", en: "Head Teacher" },
  { key: "asst_head_teacher", bn: "সহকারী প্রধান শিক্ষক", en: "Assistant Head Teacher" },
  { key: "exam_controller", bn: "পরীক্ষা নিয়ন্ত্রক", en: "Exam Controller" },
  { key: "accountant", bn: "হিসাবরক্ষক", en: "Accountant" },
] as const;

/** A signature is line art at 128x64 on a printed page. */
const SIGNATURE_MAX_BYTES = 512 * 1024;

export function SignatureScreen() {
  const { t } = useT();
  const msg = useErrorMessage();
  const toast = useToast();
  const inst = useInstitution();
  const sigs = useSignatures();
  const upsert = useUpsertSignature();

  const [names, setNames] = useState<Record<string, string>>({});
  const [urls, setUrls] = useState<Record<string, string | null>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const byRole = (key: string) => sigs.data?.find((s) => s.role_label === key) ?? null;

  useEffect(() => {
    if (!sigs.data) return;
    setNames((prev) => {
      const next = { ...prev };
      for (const r of ROLES) if (next[r.key] === undefined) next[r.key] = byRole(r.key)?.holder_name ?? "";
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sigs.data]);

  useEffect(() => {
    (sigs.data ?? []).forEach((s) => {
      if (!s.image_file_id) return;
      getAssetSignedUrl(createClient(), s.image_file_id).then((url) => setUrls((p) => ({ ...p, [s.role_label]: url }))).catch(() => {});
    });
  }, [sigs.data]);

  function saveName(roleKey: string) {
    const existing = byRole(roleKey);
    upsert.mutate(
      { id: existing?.id, role_label: roleKey, holder_name: names[roleKey] ?? "" },
      {
        onSuccess: () => toast({ title: t("স্বাক্ষর সংরক্ষিত", "Signature saved"), variant: "success" }),
        onError: (e: unknown) => toast({ title: msg(e, { bn: "সংরক্ষণ ব্যর্থ", en: "Save failed" }), variant: "error" }),
      },
    );
  }

  async function onImagePick(roleKey: string, file: File) {
    if (!inst.data) return;
    setUploading(roleKey);
    try {
      const existing = byRole(roleKey);
      const fileId = await uploadInstitutionAsset(createClient(), {
        institutionId: inst.data.id,
        entity: "signature",
        entityId: roleKey,
        file,
        maxBytes: SIGNATURE_MAX_BYTES,
      });
      await upsert.mutateAsync({ id: existing?.id, role_label: roleKey, holder_name: names[roleKey] ?? existing?.holder_name ?? "", image_file_id: fileId });
      toast({ title: t("স্বাক্ষরের ছবি আপলোড হয়েছে", "Signature image uploaded"), variant: "success" });
    } catch (e) {
      if (e instanceof AssetRejected) {
        toast({
          title: e.reason === "type"
            ? t("PNG বা JPG ফাইল দিন", "Choose a PNG or JPG file")
            : t("ছবিটি ৫০০ KB এর বেশি — ছোট ছবি দিন", "That image is over 500 KB — pick a smaller one"),
          variant: "error",
        });
      } else {
        toast({ title: msg(e, { bn: "আপলোড ব্যর্থ", en: "Upload failed" }), variant: "error" });
      }
    } finally {
      setUploading(null);
    }
  }

  return (
    <div className="flex flex-col gap-5 pb-6">
      <PageHeader
        crumbs={[{ label: t("কোর সেটিংস", "Core Settings"), href: "/admin/core/basic-config" }, { label: t("প্রতিষ্ঠান সেটিংস", "Institution Settings") }, { label: t("স্বাক্ষর", "Signatures") }]}
        title={t("অনুমোদিত স্বাক্ষর", "Approved Signatures")}
        subtitle={t("মার্কশিট, সার্টিফিকেট ও প্রশাসনে ব্যবহৃত স্বাক্ষর", "Signatures used on marksheets, certificates & administration")}
      />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {ROLES.map((r) => {
          const url = urls[r.key];
          return (
            <div key={r.key} className="flex flex-col gap-4 rounded-2xl border border-border-default bg-surface p-4.5 shadow-e1">
              <p className="text-body font-semibold text-text-primary">{t(r.bn, r.en)}</p>
              <Field label={t("নাম", "Name")}>
                <Input
                  value={names[r.key] ?? ""}
                  onChange={(e) => setNames((p) => ({ ...p, [r.key]: e.target.value }))}
                  onBlur={() => saveName(r.key)}
                />
              </Field>
              <div className="flex flex-col items-center gap-2.5 rounded-xl border border-dashed border-border-strong bg-sunken px-5 py-6">
                {url ? (
                  // Deliberately a raw <img>, not next/image: this is a 1-hour
                  // signed URL into the PRIVATE institution-assets bucket.
                  // Routing it through the Next image optimizer would cache a
                  // tenant's private asset behind a public /_next/image URL.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={url}
                    alt={t(`${r.bn} স্বাক্ষর`, `${r.en} signature`)}
                    className="h-16 w-32 object-contain"
                  />
                ) : (
                  <div className="grid h-16 w-32 place-items-center rounded-lg bg-border-default/40 text-text-muted"><Upload size={20} /></div>
                )}
                <button
                  type="button"
                  onClick={() => fileInputs.current[r.key]?.click()}
                  disabled={uploading === r.key}
                  className="flex items-center gap-1.5 text-meta font-medium text-text-secondary hover:underline disabled:opacity-60"
                >
                  <Upload size={14} /> {uploading === r.key ? t("আপলোড হচ্ছে…", "Uploading…") : t("স্বাক্ষরের ছবি আপলোড করুন", "Upload signature image")}
                </button>
                <p className="text-micro text-text-muted">{t("PNG (স্বচ্ছ ব্যাকগ্রাউন্ড) • সর্বোচ্চ ৫০০KB", "PNG (transparent) • up to 500KB")}</p>
                <input
                  ref={(el) => { fileInputs.current[r.key] = el; }}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={(e) => { const file = e.target.files?.[0]; if (file) onImagePick(r.key, file); e.target.value = ""; }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
