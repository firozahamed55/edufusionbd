"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Upload, Trash2, AlertTriangle } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import { Field, Input, Button, useToast, PageHeader, ConfirmDialog, UnsavedDot } from "@/shared/ui";
import { createClient } from "@/shared/services/supabase/client";
import { uploadInstitutionAsset, getAssetSignedUrl, AssetRejected } from "@/shared/lib/institutionAssets";
import { useUnsavedGuard } from "@/shared/lib/useUnsavedGuard";
import { useSignatures, useUpsertSignature, useDeleteSignature, useInstitution } from "../../logic/hooks";
import { signatureSchema } from "../../logic/schemas";
import { useErrorMessage } from "@/shared/services/errors";

const ROLES = [
  { key: "head_teacher", bn: "প্রধান শিক্ষক", en: "Head Teacher" },
  { key: "asst_head_teacher", bn: "সহকারী প্রধান শিক্ষক", en: "Assistant Head Teacher" },
  { key: "exam_controller", bn: "পরীক্ষা নিয়ন্ত্রক", en: "Exam Controller" },
  { key: "accountant", bn: "হিসাবরক্ষক", en: "Accountant" },
] as const;

/** A signature is line art at 128x64 on a printed page. */
const SIGNATURE_MAX_BYTES = 512 * 1024;

/**
 * Core · Approved Signatures.
 *
 * THE OLD SCREEN SAVED ON BLUR (audit A-5, S-5.1). Tabbing through the form
 * fired four writes; there was no dirty state, no cancel, and no undo, and the
 * only feedback was a toast unattached to any field. WCAG 3.2.2 On Input is
 * explicit that changing a control must not commit a change of context by
 * itself — and this is a legal artefact on a certificate, not a filter chip.
 * It is now an ordinary form: type, see the unsaved dot, press Save.
 *
 * `useDeleteSignature` existed in `hooks.ts` and was never imported (S-5.2), so
 * a wrong signature image was permanent. It is wired here.
 *
 * `signature = 0` in production (S-5.9) means every certificate the product has
 * printed to date is unsigned, and nothing said so. The banner does.
 */
export function SignatureScreen() {
  const { t } = useT();
  const msg = useErrorMessage();
  const toast = useToast();
  const inst = useInstitution();
  const sigs = useSignatures();
  const upsert = useUpsertSignature();
  const del = useDeleteSignature();

  /** Editor state per role, and the value it was loaded with. */
  const [names, setNames] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [urls, setUrls] = useState<Record<string, string | null>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const rows = useMemo(() => sigs.data ?? [], [sigs.data]);
  const byRole = useMemo(
    () => new Map(rows.map((s) => [s.role_label, s])),
    [rows],
  );

  // One effect, keyed on the fetched rows, seeding BOTH the editor value and
  // the baseline. The old version called a `byRole` closure inside the effect
  // behind an `exhaustive-deps` suppression (S-5.8) — a stale-closure hazard
  // silenced rather than resolved.
  useEffect(() => {
    if (!sigs.data) return;
    const next: Record<string, string> = {};
    for (const r of ROLES) next[r.key] = sigs.data.find((s) => s.role_label === r.key)?.holder_name ?? "";
    setSaved(next);
    setNames((prev) => {
      const merged = { ...next };
      // Never clobber what the operator is in the middle of typing.
      for (const k of Object.keys(prev)) if (prev[k] !== (saved[k] ?? "")) merged[k] = prev[k];
      return merged;
    });
    // `saved` is read to preserve in-flight edits and must not re-trigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sigs.data]);

  /*
   * S-5.6 / M-13: the signed URLs were fetched one at a time in a `forEach`, so
   * four serial round trips stood between mount and a usable page, and they
   * were re-minted on every navigation back to the screen.
   */
  useEffect(() => {
    let cancelled = false;
    const withImages = rows.filter((s) => s.image_file_id);
    if (withImages.length === 0) return;
    const client = createClient();
    Promise.all(
      withImages.map((s) =>
        getAssetSignedUrl(client, s.image_file_id as string)
          .then((url) => [s.role_label, url] as const)
          .catch(() => [s.role_label, null] as const),
      ),
    ).then((pairs) => { if (!cancelled) setUrls(Object.fromEntries(pairs)); });
    return () => { cancelled = true; };
  }, [rows]);

  const isDirty = (key: string) => (names[key] ?? "") !== (saved[key] ?? "");
  const anyDirty = ROLES.some((r) => isDirty(r.key));
  useUnsavedGuard(anyDirty);

  /** A blank holder name prints a blank signature block on a legal document. */
  const errorFor = (key: string) => {
    if (!touched[key]) return undefined;
    const value = names[key] ?? "";
    if (value === "" && !byRole.get(key)) return undefined; // untouched empty card
    const parsed = signatureSchema.safeParse({ role_label: key, holder_name: value });
    return parsed.success ? undefined : parsed.error.issues.find((i) => i.path[0] === "holder_name")?.message;
  };

  function save(roleKey: string) {
    const value = (names[roleKey] ?? "").trim();
    const parsed = signatureSchema.safeParse({ role_label: roleKey, holder_name: value });
    if (!parsed.success) {
      setTouched((p) => ({ ...p, [roleKey]: true }));
      document.getElementById(`sig-${roleKey}`)?.focus();
      return;
    }
    upsert.mutate(
      { id: byRole.get(roleKey)?.id, role_label: roleKey, holder_name: value },
      {
        onSuccess: () => {
          setSaved((p) => ({ ...p, [roleKey]: value }));
          toast({ title: t("স্বাক্ষর সংরক্ষিত", "Signature saved"), variant: "success" });
        },
        onError: (e: unknown) => toast({ title: msg(e, { bn: "সংরক্ষণ ব্যর্থ", en: "Save failed" }), variant: "error" }),
      },
    );
  }

  async function onImagePick(roleKey: string, file: File) {
    if (!inst.data) return;
    setUploading(roleKey);
    try {
      const existing = byRole.get(roleKey);
      const fileId = await uploadInstitutionAsset(createClient(), {
        institutionId: inst.data.id,
        entity: "signature",
        entityId: roleKey,
        file,
        maxBytes: SIGNATURE_MAX_BYTES,
      });
      await upsert.mutateAsync({
        id: existing?.id,
        role_label: roleKey,
        // The RPC requires a name. Uploading an image before typing one would
        // otherwise fail with a rule the operator has not reached yet.
        holder_name: (names[roleKey] || existing?.holder_name || t("অনির্ধারিত", "Not set")).trim(),
        image_file_id: fileId,
      });
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

  function confirmRemove() {
    const key = removing;
    const row = key ? byRole.get(key) : null;
    setRemoving(null);
    if (!row) return;
    del.mutate(row.id, {
      onSuccess: () => {
        setUrls((p) => ({ ...p, [row.role_label]: null }));
        setNames((p) => ({ ...p, [row.role_label]: "" }));
        setSaved((p) => ({ ...p, [row.role_label]: "" }));
        toast({ title: t("স্বাক্ষর মুছে ফেলা হয়েছে", "Signature removed"), variant: "success" });
      },
      onError: (e: unknown) => toast({ title: msg(e, { bn: "মোছা যায়নি", en: "Could not remove" }), variant: "error" }),
    });
  }

  const configured = rows.filter((s) => s.image_file_id).length;

  return (
    <div className="flex flex-col gap-5 pb-6">
      <PageHeader
        crumbs={[{ label: t("সেটিংস", "Settings"), href: "/admin/core" }, { label: t("প্রতিষ্ঠান সেটিংস", "Institution Settings") }, { label: t("স্বাক্ষর", "Signatures") }]}
        title={t("অনুমোদিত স্বাক্ষর", "Approved Signatures")}
        subtitle={t("মার্কশিট, সার্টিফিকেট ও প্রশাসনে ব্যবহৃত স্বাক্ষর", "Signatures used on marksheets, certificates & administration")}
      />

      {/* S-5.9: with zero signatures configured, every certificate the product
          prints comes out unsigned — and until now nothing anywhere said so. */}
      {!sigs.isLoading && configured === 0 ? (
        <p role="status" className="flex items-start gap-2 rounded-xl border border-warning-fg/30 bg-warning-bg px-4 py-3 text-meta text-warning-fg">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
          {t(
            "কোনো স্বাক্ষর সেট করা নেই — এখন পর্যন্ত ছাপানো প্রতিটি মার্কশিট ও সার্টিফিকেট স্বাক্ষরবিহীন।",
            "No signature is configured — every marksheet and certificate printed so far is unsigned.",
          )}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {ROLES.map((r) => {
          const url = urls[r.key];
          const row = byRole.get(r.key);
          const dirty = isDirty(r.key);
          return (
            <div key={r.key} className="flex flex-col gap-4 rounded-2xl border border-border-default bg-surface p-4.5 shadow-e1">
              <div className="flex items-center gap-2">
                <p className="flex-1 text-body font-semibold text-text-primary">{t(r.bn, r.en)}</p>
                {dirty ? <span className="flex items-center gap-1.5 text-micro text-text-muted"><UnsavedDot /> {t("অসংরক্ষিত", "Unsaved")}</span> : null}
              </div>

              <Field
                label={t("নাম", "Name")}
                error={errorFor(r.key)}
                onBlur={() => setTouched((p) => ({ ...p, [r.key]: true }))}
              >
                <Input
                  id={`sig-${r.key}`}
                  value={names[r.key] ?? ""}
                  onChange={(e) => setNames((p) => ({ ...p, [r.key]: e.target.value }))}
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
                  <Upload size={14} /> {uploading === r.key
                    ? t("আপলোড হচ্ছে…", "Uploading…")
                    : url ? t("ছবি বদলান", "Replace image") : t("স্বাক্ষরের ছবি আপলোড করুন", "Upload signature image")}
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

              <div className="flex items-center gap-2">
                {row ? (
                  <Button variant="ghost" onClick={() => setRemoving(r.key)} className="text-danger-fg">
                    <Trash2 size={15} /> {t("সরান", "Remove")}
                  </Button>
                ) : null}
                <div className="flex-1" />
                <Button variant="primary" onClick={() => save(r.key)} disabled={!dirty || upsert.isPending}>
                  {t("সংরক্ষণ করুন", "Save")}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={confirmRemove}
        tone="danger"
        title={t("স্বাক্ষর সরাবেন?", "Remove this signature?")}
        description={t(
          "এই ভূমিকার নাম ও ছবি দুটোই মুছে যাবে। ইতিমধ্যে ছাপানো কাগজ অপরিবর্তিত থাকবে; নতুন মার্কশিট ও সার্টিফিকেট এই স্বাক্ষর ছাড়াই ছাপা হবে।",
          "Both the name and the image for this role are removed. Paper already printed is unaffected; new marksheets and certificates print without this signature.",
        )}
        confirmLabel={t("সরান", "Remove")}
        cancelLabel={t("বাতিল", "Cancel")}
        loading={del.isPending}
      />
    </div>
  );
}
