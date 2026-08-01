/**
 * Everything a printed artefact needs from the institution that is not the
 * record itself: the letterhead, the logo, and the authorised signatures
 * (SRA A-7 points 4 and 7 — a Signature settings screen existed with nothing
 * consuming it).
 */
import type { BrowserClient } from "@/shared/services/supabase/types";
import { getAssetSignedUrl } from "@/shared/lib/institutionAssets";

export type Letterhead = {
  name_bn: string;
  name_en: string;
  address: string | null;
  eiin: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logoUrl: string | null;
};

export async function fetchLetterhead(s: BrowserClient): Promise<Letterhead | null> {
  const { data, error } = await s
    .from("institution")
    .select("name_bn, name_en, address, eiin, phone, email, website, logo_file_id")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  // A missing or unreadable logo must not fail the whole document — a school
  // that never uploaded one still needs to print ID cards today.
  const logoUrl = data.logo_file_id ? await getAssetSignedUrl(s, data.logo_file_id).catch(() => null) : null;
  return { ...data, logoUrl };
}

export type DocSignature = { id: string; role_label: string; holder_name: string | null; imageUrl: string | null };

export async function fetchDocSignatures(s: BrowserClient): Promise<DocSignature[]> {
  const { data, error } = await s.from("signature").select("id, role_label, holder_name, image_file_id").order("created_at");
  if (error) throw error;
  return Promise.all(
    (data ?? []).map(async (r) => ({
      id: r.id,
      role_label: r.role_label,
      holder_name: r.holder_name,
      imageUrl: r.image_file_id ? await getAssetSignedUrl(s, r.image_file_id).catch(() => null) : null,
    })),
  );
}

/**
 * Signed URLs for a batch of student photos, keyed by student id.
 *
 * ONE query for the file rows and one `createSignedUrls` call for the whole
 * batch — not `getAssetSignedUrl` per student. A 400-card ID batch would
 * otherwise be 800 sequential round trips, which is a preview that never
 * finishes on a school's connection.
 */
export async function fetchStudentPhotoUrls(
  s: BrowserClient,
  photoFileIds: readonly (string | null)[],
): Promise<Record<string, string>> {
  const ids = [...new Set(photoFileIds.filter((v): v is string => !!v))];
  if (ids.length === 0) return {};

  const { data: files, error } = await s.from("file_object").select("id, bucket, path").in("id", ids);
  if (error) throw error;
  const rows = (files ?? []) as { id: string; bucket: string; path: string }[];
  if (rows.length === 0) return {};

  const bucket = rows[0].bucket;
  const { data: signed, error: signErr } = await s.storage
    .from(bucket)
    .createSignedUrls(rows.map((r) => r.path), 3600);
  if (signErr) return {};

  const byPath = new Map((signed ?? []).map((v) => [v.path ?? "", v.signedUrl]));
  const out: Record<string, string> = {};
  for (const r of rows) {
    const url = byPath.get(r.path);
    if (url) out[r.id] = url;
  }
  return out;
}
