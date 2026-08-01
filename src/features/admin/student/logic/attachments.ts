/**
 * Student photo + document attachment (SRA A-2.1 item 1).
 *
 * Two phases, deliberately. The admission form has no student id until
 * `fn_register_student` returns one, so the bytes cannot be uploaded on drop —
 * the storage path is `{institution}/{entity}/{entityId}-…` and there is no
 * entityId yet. `attachStudentFiles` runs on the success of the save, which is
 * also why a failed attach reports separately: the STUDENT is registered even
 * if the photo did not land, and telling the operator "save failed" would be
 * a lie that makes them re-enter 31 fields.
 */
import type { BrowserClient } from "@/shared/services/supabase/types";
import { uploadInstitutionAsset } from "@/shared/lib/institutionAssets";

/** Document slots on the admission form. Values are `student_document.type`. */
export const STUDENT_DOC_TYPES = ["birth_certificate", "previous_tc", "guardian_nid"] as const;
export type StudentDocType = (typeof STUDENT_DOC_TYPES)[number];

export type PendingFiles = {
  photo?: File | null;
  documents?: Partial<Record<StudentDocType, File | null>>;
};

async function attachOne(
  s: BrowserClient,
  institutionId: string,
  studentId: string,
  kind: string,
  file: File,
): Promise<void> {
  const fileId = await uploadInstitutionAsset(s, {
    institutionId,
    entity: kind === "photo" ? "student_photo" : "student_document",
    entityId: studentId,
    file,
  });
  const { error } = await s.rpc("fn_attach_student_file", {
    payload: { student_id: studentId, file_id: fileId, kind },
  });
  if (error) throw new Error(error.message);
}

/** Detach — the operator removed an existing photo or document. */
export async function detachStudentFile(s: BrowserClient, studentId: string, kind: string): Promise<void> {
  const { error } = await s.rpc("fn_attach_student_file", {
    payload: { student_id: studentId, file_id: null, kind },
  });
  if (error) throw new Error(error.message);
}

/**
 * Upload and attach everything the operator picked.
 *
 * Returns the kinds that FAILED rather than throwing on the first one: a
 * missing guardian NID should not prevent the birth certificate from
 * attaching, and the caller needs to name what is missing.
 */
export async function attachStudentFiles(
  s: BrowserClient,
  { institutionId, studentId, files }: { institutionId: string; studentId: string; files: PendingFiles },
): Promise<string[]> {
  const jobs: { kind: string; file: File }[] = [];
  if (files.photo) jobs.push({ kind: "photo", file: files.photo });
  for (const [kind, file] of Object.entries(files.documents ?? {})) {
    if (file) jobs.push({ kind, file });
  }
  if (jobs.length === 0) return [];

  const results = await Promise.allSettled(
    jobs.map((j) => attachOne(s, institutionId, studentId, j.kind, j.file)),
  );
  return jobs.filter((_, i) => results[i].status === "rejected").map((j) => j.kind);
}
