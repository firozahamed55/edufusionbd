"use client";

import { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import {
  FormCard, Field, Input, Textarea, Select, Skeleton, SaveBar, UnsavedDot, useToast, Button, PageHeader,
} from "@/shared/ui";
import { createClient } from "@/shared/services/supabase/client";
import { uploadInstitutionAsset, getAssetSignedUrl, AssetRejected } from "@/shared/lib/institutionAssets";
import { useUnsavedGuard } from "@/shared/lib/useUnsavedGuard";
import { useZodForm } from "@/shared/lib/useZodForm";
import { useInstitution, useUpdateInstitution, useEducationBoards, useTeacherOptions } from "../../logic/hooks";
import { startupSchema, type StartupValues } from "../../logic/schemas";
import { useErrorMessage } from "@/shared/services/errors";

const INSTITUTION_TYPES = [
  ["school", "স্কুল", "School"], ["college", "কলেজ", "College"], ["madrasha", "মাদ্রাসা", "Madrasha"], ["coaching", "কোচিং সেন্টার", "Coaching Center"],
] as const;
const MPO_STATUSES = [["mpo", "MPO ভুক্ত", "MPO enlisted"], ["non_mpo", "Non-MPO", "Non-MPO"]] as const;

/** What the caption has always claimed. It is now also what happens. */
const LOGO_MAX_BYTES = 1024 * 1024;

const EMPTY: StartupValues = {
  name_bn: "", name_en: "", eiin: "", institution_code: "", institution_type: "",
  established_year: "", board_id: "", mpo_status: "", phone: "", email: "", website: "",
  address: "", head_teacher_id: "",
};

/**
 * Core · StartUp — the institution's identity.
 *
 * THIS SCREEN HAD NO VALIDATION AT ALL (audit S-2.1). EIIN, email, phone,
 * website and founding year each accepted any string, and all five print on
 * every marksheet and certificate and are submitted to the board. `99999` was
 * an acceptable founding year. The zod layer this codebase already uses on
 * Student, Teacher, Fee and SMS is now here too.
 *
 * It also tracked `dirty` for the SaveBar and never called `useUnsavedGuard`
 * (M-11), so closing the tab mid-edit on the data printed on every certificate
 * lost the work with no warning. One line, and the class of bug is "the second
 * screen didn't get the treatment the first one did".
 */
export function StartupScreen() {
  const { t, isBn } = useT();
  const msg = useErrorMessage();
  const toast = useToast();
  const inst = useInstitution();
  const boards = useEducationBoards();
  const teachers = useTeacherOptions();
  const update = useUpdateInstitution();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useZodForm(startupSchema, EMPTY);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);

  // One initialiser, used by both load and reset. There used to be two
  // identical blocks (audit S-2.10) and they were always going to drift.
  const { reset } = form;
  useEffect(() => {
    if (!inst.data) return;
    const meta = inst.data.metadata ?? {};
    reset({
      name_bn: inst.data.name_bn ?? "", name_en: inst.data.name_en ?? "", eiin: inst.data.eiin ?? "",
      institution_code: String(meta.institution_code ?? ""), institution_type: inst.data.institution_type ?? "",
      established_year: inst.data.established_year != null ? String(inst.data.established_year) : "",
      board_id: inst.data.board_id ?? "", mpo_status: String(meta.mpo_status ?? ""),
      phone: inst.data.phone ?? "", email: inst.data.email ?? "", website: inst.data.website ?? "",
      address: inst.data.address ?? "", head_teacher_id: inst.data.head_teacher_id ?? "",
    });
  }, [inst.data, reset]);

  useEffect(() => {
    if (!inst.data?.logo_file_id) { setLogoUrl(null); return; }
    getAssetSignedUrl(createClient(), inst.data.logo_file_id).then(setLogoUrl).catch(() => setLogoUrl(null));
  }, [inst.data?.logo_file_id]);

  const f = form.values;
  const set = (k: keyof StartupValues, v: string) => form.setValue(k, v);
  const headTeacher = teachers.data?.find((tc) => tc.id === f.head_teacher_id);

  // The data printed on every certificate, lost on a tab close (audit M-11).
  useUnsavedGuard(form.isDirty);

  function onSave() {
    const parsed = form.submit();
    if (!parsed) {
      toast({ title: t("চিহ্নিত ফিল্ডগুলো ঠিক করুন", "Fix the highlighted fields"), variant: "error" });
      // Land the operator on the problem rather than leaving them on the Save
      // button with a toast and no route to it (audit A-4 / WCAG 3.3.1).
      form.focusFirstError();
      return;
    }
    update.mutate(
      {
        name_bn: parsed.name_bn, name_en: parsed.name_en, eiin: parsed.eiin,
        institution_type: parsed.institution_type ?? "", established_year: parsed.established_year,
        board_id: parsed.board_id, head_teacher_id: parsed.head_teacher_id, phone: parsed.phone ?? "",
        email: parsed.email, website: parsed.website, address: parsed.address ?? "",
        metadata: { institution_code: parsed.institution_code ?? "", mpo_status: parsed.mpo_status ?? "" },
      },
      {
        onSuccess: () => { toast({ title: t("সংরক্ষিত হয়েছে", "Saved"), variant: "success" }); form.reset(form.values); },
        onError: (e: unknown) => toast({ title: msg(e, { bn: "সংরক্ষণ ব্যর্থ", en: "Save failed" }), variant: "error" }),
      },
    );
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
      <PageHeader
        crumbs={[{ label: t("সেটিংস", "Settings"), href: "/admin/core" }, { label: t("প্রতিষ্ঠান সেটিংস", "Institution Settings") }, { label: t("প্রতিষ্ঠানের পরিচিতি", "Institution Identity") }]}
        title={t("প্রতিষ্ঠানের পরিচিতি", "Institution Identity")}
        subtitle={t("প্রতিষ্ঠানের মৌলিক পরিচিতি ও প্রাথমিক সেটআপ", "The institution's core identity & initial setup")}
      />

      {inst.isLoading ? (
        <div className="flex flex-col gap-3 rounded-2xl bg-surface p-6 shadow-e1">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-11" />)}</div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-col gap-5">
            <FormCard title={t("প্রতিষ্ঠানের পরিচিতি", "Institution Identity")}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label={t("প্রতিষ্ঠানের নাম (বাংলা)", "Institution Name (Bangla)")} required {...form.bind("name_bn")}>
                  <Input id="f-name_bn" value={f.name_bn} onChange={(e) => set("name_bn", e.target.value)} />
                </Field>
                <Field label={t("Institute Name (English)", "Institute Name (English)")} required {...form.bind("name_en")}>
                  <Input id="f-name_en" value={f.name_en} onChange={(e) => set("name_en", e.target.value)} className="font-latin" />
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label={t("EIIN", "EIIN")} hint={t("৬ সংখ্যা", "6 digits")} {...form.bind("eiin")}>
                  <Input id="f-eiin" inputMode="numeric" value={f.eiin} onChange={(e) => set("eiin", e.target.value)} className="font-latin" />
                </Field>
                <Field label={t("প্রতিষ্ঠান কোড", "Institution code")} {...form.bind("institution_code")}>
                  <Input id="f-institution_code" value={f.institution_code} onChange={(e) => set("institution_code", e.target.value)} className="font-latin" placeholder="GVS-2026" />
                </Field>
                <Field label={t("ধরন", "Type")}>
                  <Select value={f.institution_type} placeholder={t("নির্বাচন", "Select")} options={INSTITUTION_TYPES.map(([v, bn, en]) => ({ value: v, label: isBn ? bn : en }))} onChange={(e) => set("institution_type", e.target.value)} />
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label={t("প্রতিষ্ঠার সাল", "Founding year")} {...form.bind("established_year")}>
                  <Input id="f-established_year" type="number" value={f.established_year} onChange={(e) => set("established_year", e.target.value)} className="font-latin" />
                </Field>
                <Field label={t("শিক্ষা বোর্ড", "Education board")}>
                  <Select value={f.board_id} placeholder={boards.isLoading ? t("লোড হচ্ছে…", "Loading…") : t("নির্বাচন", "Select")} options={(boards.data ?? []).map((b) => ({ value: b.id, label: b.label }))} onChange={(e) => set("board_id", e.target.value)} />
                </Field>
                <Field label={t("MPO স্ট্যাটাস", "MPO status")}>
                  <Select value={f.mpo_status} placeholder={t("নির্বাচন", "Select")} options={MPO_STATUSES.map(([v, bn, en]) => ({ value: v, label: isBn ? bn : en }))} onChange={(e) => set("mpo_status", e.target.value)} />
                </Field>
              </div>
            </FormCard>

            <FormCard title={t("যোগাযোগ", "Contact")}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label={t("মোবাইল", "Mobile")} hint={t("০১৭xxxxxxxx", "01XXXXXXXXX")} {...form.bind("phone")}>
                  <Input id="f-phone" inputMode="numeric" value={f.phone} onChange={(e) => set("phone", e.target.value)} className="font-latin" />
                </Field>
                <Field label={t("ইমেইল", "Email")} {...form.bind("email")}>
                  <Input id="f-email" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} className="font-latin" />
                </Field>
                <Field label={t("ওয়েবসাইট", "Website")} {...form.bind("website")}>
                  <Input id="f-website" value={f.website} onChange={(e) => set("website", e.target.value)} className="font-latin" placeholder="school.edu.bd" />
                </Field>
              </div>
              <Field label={t("ঠিকানা", "Address")} {...form.bind("address")}>
                <Textarea id="f-address" value={f.address} onChange={(e) => set("address", e.target.value)} />
              </Field>
            </FormCard>

            <FormCard title={t("প্রধান শিক্ষকের তথ্য", "Head Teacher Info")}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label={t("শিক্ষক নির্বাচন", "Select teacher")}>
                  <Select value={f.head_teacher_id} placeholder={teachers.isLoading ? t("লোড হচ্ছে…", "Loading…") : t("নির্বাচন", "Select")} options={(teachers.data ?? []).map((tc) => ({ value: tc.id, label: tc.label }))} onChange={(e) => set("head_teacher_id", e.target.value)} />
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
                {/* display:none and clicked programmatically — but still needs
                    a name, or it announces as "file, blank" to anyone who
                    reaches it through the forms rota. */}
                <input ref={fileInputRef} type="file" aria-label={t("প্রতিষ্ঠানের লোগো ফাইল", "Institution logo file")} accept="image/png,image/jpeg,image/svg+xml" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) onLogoPick(file); e.target.value = ""; }} />
              </div>
            </FormCard>

            {/* S-2.7: the callout SAID this data prints on a marksheet header
                and the operator could not see it. Now it shows the header as
                it will print, from the values in the form. */}
            <MarksheetHeaderPreview
              nameBn={f.name_bn}
              nameEn={f.name_en}
              address={f.address}
              eiin={f.eiin}
              logoUrl={logoUrl}
            />
          </div>
        </div>
      )}

      <SaveBar status={form.isDirty ? <><UnsavedDot /> {t("অসংরক্ষিত পরিবর্তন", "Unsaved changes")}</> : null}>
        <Button variant="secondary" onClick={() => form.reset()} disabled={!form.isDirty}>{t("রিসেট", "Reset")}</Button>
        <Button variant="primary" onClick={onSave} disabled={update.isPending || !form.isDirty}>
          {update.isPending ? t("সংরক্ষণ হচ্ছে…", "Saving…") : t("সংরক্ষণ করুন", "Save")}
        </Button>
      </SaveBar>
    </div>
  );
}

/**
 * The certificate header, rendered from the live form values (audit S-2.7).
 *
 * Not a decorative flourish: this is the only place in the product an operator
 * can see what the identity data actually produces before it is printed on
 * three hundred marksheets. A truncated name or a missing EIIN is obvious here
 * and invisible in a form.
 */
function MarksheetHeaderPreview({
  nameBn, nameEn, address, eiin, logoUrl,
}: {
  nameBn: string; nameEn: string; address: string; eiin: string; logoUrl: string | null;
}) {
  const { t, isBn } = useT();
  return (
    <FormCard title={t("মার্কশিট হেডার প্রিভিউ", "Marksheet header preview")}>
      <div className="flex flex-col items-center gap-1.5 rounded-xl border border-border-strong bg-surface px-4 py-5 text-center">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="mb-1 size-12 object-contain" />
        ) : null}
        <p className="text-base font-bold leading-tight text-text-primary">
          {(isBn ? nameBn : nameEn) || t("প্রতিষ্ঠানের নাম", "Institution name")}
        </p>
        {address ? <p className="text-micro text-text-secondary">{address}</p> : null}
        <p className="font-latin text-micro text-text-muted">
          {eiin ? `EIIN ${eiin}` : t("EIIN নেই", "No EIIN set")}
        </p>
      </div>
      <p className="text-micro text-text-muted">
        {t(
          "এই তথ্য মার্কশিট, সার্টিফিকেট ও রিপোর্টের হেডারে ছাপা হয়।",
          "This is what prints at the top of every marksheet, certificate and report.",
        )}
      </p>
    </FormCard>
  );
}
