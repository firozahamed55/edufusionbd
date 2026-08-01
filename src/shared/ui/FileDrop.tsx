"use client";

import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { Trash2, Upload, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { ImageTooLargeError, resizeImage } from "@/shared/lib/imageResize";

/* eslint-disable @next/next/no-img-element -- the preview is an object URL for
   a file that has not been uploaded yet; there is nothing for a loader to
   optimise, and next/image would fetch the blob URL through the optimiser. */

export type FileDropState = {
  /** Selected (already downscaled) file, waiting to be or being uploaded. */
  file: File | null;
  /** Local object URL for the preview, or a signed URL for an existing asset. */
  previewUrl: string | null;
};

/**
 * Drag-and-drop file picker with preview, progress, per-file error and delete
 * (SRA A-2.1 item 1 — the three "Upload" buttons and the dropzone on the
 * admission form were inert, with a source comment saying "upload wired in a
 * later pass").
 *
 * Deliberately does NOT upload. It owns selection, validation and downscaling;
 * the screen owns when the bytes leave, because the admission form has no
 * student id to attach them to until the record is saved. Two-phase — save
 * then attach — is the only correct order there, and a component that uploaded
 * on drop could not express it.
 */
export function FileDrop({
  label,
  accept = "image/*",
  existingUrl,
  onChange,
  uploading,
  error,
  compact,
  children,
}: {
  label: string;
  accept?: string;
  /** Signed URL of the already-stored asset, if any. */
  existingUrl?: string | null;
  onChange: (file: File | null) => void;
  uploading?: boolean;
  /** Upload error from the screen, rendered beside the local validation one. */
  error?: string | null;
  compact?: boolean;
  /** Empty-state artwork for the full-size variant. */
  children?: ReactNode;
}) {
  const { t } = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);

  // Object URLs are a leak if they outlive the component or the next pick.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function accepted(picked: File | null | undefined) {
    setLocalError(null);
    if (!picked) return;
    setBusy(true);
    try {
      const prepared = await resizeImage(picked);
      setPreview((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(prepared); });
      onChange(prepared);
    } catch (e) {
      setLocalError(
        e instanceof ImageTooLargeError
          ? t("ফাইলটি ২ MB-এর বেশি এবং ছোট করা যায়নি", "The file is over 2 MB and could not be reduced")
          : t("ফাইলটি পড়া যায়নি", "The file could not be read"),
      );
      onChange(null);
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    setPreview((old) => { if (old) URL.revokeObjectURL(old); return null; });
    setLocalError(null);
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setOver(false);
    void accepted(e.dataTransfer.files?.[0]);
  }

  const shown = preview ?? existingUrl ?? null;
  const message = localError ?? error ?? null;

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept={accept}
      className="sr-only"
      aria-label={label}
      onChange={(e) => void accepted(e.target.files?.[0])}
    />
  );

  if (compact) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border-default bg-surface px-3 py-2.5">
        <span className="min-w-0 flex-1 truncate text-meta text-text-secondary">
          {label}
          {message ? <span className="mt-0.5 block text-micro text-danger-fg" role="alert">{message}</span> : null}
          {shown && !message ? <span className="mt-0.5 block text-micro text-success-fg">{t("সংযুক্ত", "Attached")}</span> : null}
        </span>
        {shown ? (
          <button type="button" onClick={clear} aria-label={t("সরান", "Remove")} className="shrink-0 text-text-muted hover:text-danger-fg">
            <Trash2 size={15} />
          </button>
        ) : null}
        <label className="flex shrink-0 cursor-pointer items-center gap-1 text-meta font-semibold text-primary hover:underline">
          {busy || uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {t("আপলোড", "Upload")}
          {input}
        </label>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <label
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-2.5 rounded-xl border border-dashed px-5 py-6 text-center transition-colors",
          over ? "border-primary bg-primary-subtle" : "border-border-strong bg-sunken",
        )}
      >
        {shown ? (
          <img src={shown} alt="" className="h-28 w-24 rounded-lg object-cover" />
        ) : (
          children
        )}
        <p className="text-sm font-medium text-text-secondary">
          {busy || uploading
            ? t("প্রস্তুত হচ্ছে…", "Preparing…")
            : t("ছবি টেনে আনুন বা নির্বাচন করুন", "Drag or select a photo")}
        </p>
        <p className="text-xs text-text-muted">JPG/PNG • {t("সর্বোচ্চ ২ MB", "max 2 MB")}</p>
        {input}
      </label>
      {message ? (
        <p role="alert" className="flex items-center gap-1.5 text-meta text-danger-fg">
          <AlertCircle size={14} /> {message}
        </p>
      ) : null}
      {shown ? (
        <button type="button" onClick={clear} className="self-center text-meta text-text-muted hover:text-danger-fg">
          <Trash2 size={13} className="mr-1 inline" /> {t("ছবি সরান", "Remove photo")}
        </button>
      ) : null}
    </div>
  );
}
