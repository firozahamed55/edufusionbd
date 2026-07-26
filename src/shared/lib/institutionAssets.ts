/**
 * Upload/read helper for the private `institution-assets` storage bucket.
 * Path convention: `{institution_id}/{entity}/{filename}` — storage RLS
 * checks the first path segment against the caller's own institution_id,
 * so every call site must pass its own institutionId, never a guessed one.
 */
import type { BrowserClient } from "@/shared/services/supabase/types";

const BUCKET = "institution-assets";


export async function uploadInstitutionAsset(
  s: BrowserClient,
  { institutionId, entity, entityId, file }: { institutionId: string; entity: string; entityId: string; file: File },
): Promise<string> {
  const path = `${institutionId}/${entity}/${entityId}-${Date.now()}-${file.name}`;
  const { error: upErr } = await s.storage.from(BUCKET).upload(path, file, { upsert: true });
  if (upErr) throw upErr;

  const { data, error } = await s.rpc("fn_record_file_upload", {
    payload: { bucket: BUCKET, path, mime: file.type, size_bytes: file.size, entity, entity_id: entityId },
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
