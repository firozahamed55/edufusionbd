import { z } from "zod";
import { optionalBdMobile, shortText, uuid } from "@/shared/lib/validation";

/**
 * The three account operations Users & Roles could not perform (audit M-15,
 * S-9.1, S-9.2), and the one payload shape both sides of the HTTP boundary
 * agree on.
 *
 * Shared deliberately. `src/server/users/accountOps.ts` parses the request body
 * with the same schema the dialog validates against, so the route cannot drift
 * from the form that feeds it — the arrangement `sendCampaign` already uses.
 */

/** Bare-minimum email shape. GoTrue is the real authority and will refuse the rest. */
export const inviteEmail = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address");

export const inviteUserSchema = z.object({
  email: inviteEmail,
  full_name: shortText(120).min(2, "Enter the person's full name"),
  phone: optionalBdMobile,
  role_ids: z.array(uuid).max(10),
  /** Prepended to the invitation mail. Optional, and capped so it cannot carry a document. */
  message: z.preprocess((v) => (v === "" ? undefined : v), shortText(500).optional()),
});
export type InviteUserPayload = z.infer<typeof inviteUserSchema>;

export const profileIdSchema = z.object({ profile_id: uuid });
export type ProfileIdPayload = z.infer<typeof profileIdSchema>;

/** Every failure the three routes can return, in the shape the screen reads. */
export type AccountOpError = {
  kind:
    | "validation"
    | "unauthenticated"
    | "forbidden"
    | "rate_limited"
    | "duplicate"
    | "unknown";
  message: string;
};

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Partial<AccountOpError> & T;
  if (!res.ok) {
    /**
     * Rethrown with `code` set to the SQLSTATE the RPC raised, because
     * `shared/services/errors.ts` classifies on `code` first and the whole
     * point of that module is that a screen never has to read error text. The
     * route already mapped the SQLSTATE to an HTTP status; this puts it back
     * where the shared classifier can find it.
     */
    const error = new Error(json.message ?? "Request failed") as Error & { code?: string };
    error.code = KIND_TO_CODE[json.kind ?? "unknown"];
    throw error;
  }
  return json;
}

/** Kinds back to the codes `classifyError` already understands. */
const KIND_TO_CODE: Record<string, string> = {
  validation: "INV01",
  unauthenticated: "PGRST301",
  forbidden: "42501",
  rate_limited: "RLIM1",
  duplicate: "23505",
  unknown: "",
};

export const inviteUser = (payload: InviteUserPayload) =>
  post<{ profile_id: string; resend: boolean }>("/api/admin/users/invite", payload);

export const sendPasswordReset = (profileId: string) =>
  post<{ email: string }>("/api/admin/users/reset-password", { profile_id: profileId });

export const revokeSessions = (profileId: string) =>
  post<{ revoked: number }>("/api/admin/users/revoke-sessions", { profile_id: profileId });
