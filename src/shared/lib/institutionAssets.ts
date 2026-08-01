/**
 * Upload/read helper for the private `institution-assets` storage bucket.
 * Path convention: `{institution_id}/{entity}/{filename}` — storage RLS
 * checks the first path segment against the caller's own institution_id,
 * so every call site must pass its own institutionId, never a guessed one.
 */
import type { BrowserClient } from "@/shared/services/supabase/types";
import { resizeImage } from "@/shared/lib/imageResize";

const BUCKET = "institution-assets";

/**
 * What this bucket will accept (audit M-5).
 *
 * The bucket itself now carries `file_size_limit` and `allowed_mime_types`, and
 * that is the control — this is the same rule stated early, so an operator gets
 * a sentence in their own language rather than a 413 from the storage API after
 * waiting through the upload. Two layers on purpose: the client one is UX, the
 * bucket one is enforcement.
 */
export const ASSET_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
] as const;

/** Bucket backstop. The per-purpose limits callers pass are tighter. */
export const ASSET_MAX_BYTES = 2 * 1024 * 1024;

export class AssetRejected extends Error {
  constructor(
    readonly reason: "type" | "size",
    readonly limitBytes?: number,
  ) {
    super(`asset-rejected:${reason}`);
    this.name = "AssetRejected";
  }
}

/**
 * A storage object key that is safe to build a path from.
 *
 * `file.name` came straight off the operator's disk and went straight into the
 * object path. It carries spaces, Bengali script, `..`, `#`, `?` and whatever
 * else a phone gallery produced — none of which belongs in a URL path segment
 * that is later signed and handed to a browser.
 */
export function safeFileName(name: string): string {
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  const slug = stem
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .toLowerCase();
  return `${slug || "file"}${ext ? `.${ext}` : ""}`;
}

export async function uploadInstitutionAsset(
  s: BrowserClient,
  {
    institutionId,
    entity,
    entityId,
    file,
    maxBytes = ASSET_MAX_BYTES,
  }: {
    institutionId: string;
    entity: string;
    entityId: string;
    file: File;
    /** Per-purpose ceiling — a signature is not a birth certificate. */
    maxBytes?: number;
  },
): Promise<string> {
  if (!(ASSET_MIME_TYPES as readonly string[]).includes(file.type)) {
    throw new AssetRejected("type");
  }

  // Downscale first, then measure. A 6 MB phone photo of a signature is a
  // legitimate upload that becomes an 80 kB one, and rejecting it up front
  // would be refusing work the browser can do in a second. SVG and PDF pass
  // through untouched (see `resizeImage`) and are judged on their own size.
  let payload = file;
  try {
    payload = await resizeImage(file, { maxBytes });
  } catch {
    // ImageTooLargeError, or a decode failure on a file that claims to be an
    // image and is not. Either way the original is what gets size-checked
    // immediately below, so nothing oversized slips through this catch.
  }
  if (payload.size > maxBytes) throw new AssetRejected("size", maxBytes);

  const path = `${institutionId}/${entity}/${entityId}-${Date.now()}-${safeFileName(payload.name)}`;
  const { error: upErr } = await s.storage.from(BUCKET).upload(path, payload, { upsert: true });
  if (upErr) throw upErr;

  const { data, error } = await s.rpc("fn_record_file_upload", {
    payload: { bucket: BUCKET, path, mime: payload.type, size_bytes: payload.size, entity, entity_id: entityId },
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function getAssetSignedUrl(s: BrowserClient, fileId: string): Promise<string | null> {
  const { data: fo, error } = await s.from("file_object").select("bucket, path").eq("id", fileId).maybeSingle();
  if (error) throw error;
  if (!fo) return null;
  const { data, error: signErr } = await s.storage.from((fo as { bucket: string }).bucket).createSignedUrl((fo as { path: string }).path, 3600);
  if (signErr) throw signErr;
  return data.signedUrl;
}
