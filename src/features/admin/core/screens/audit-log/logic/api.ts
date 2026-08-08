// Data access for the Audit Log screen.
//
// Reads go through `fn_audit_log`, not through PostgREST, because `before` and
// `after` are no longer granted to `authenticated` (migration
// `20260808120000`). Those two columns are the whole student record — phone,
// guardian, address, date of birth, NID — and `audit.read` is a reporting
// permission, not consent to browse the student body's contact details. The
// RPC masks them; `fn_audit_reveal` does not, and writes an access-log entry
// naming whoever asked.
import type { BrowserClient } from "@/shared/services/supabase/types";

export type AuditLogRow = {
  id: string;
  entity: string;
  entityId: string | null;
  action: string;
  at: string;
  changedById: string | null;
  changedByName: string | null;
  /** `after->>'severity'`, written by the high-risk RPCs (audit S-11.10). */
  severity: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  /**
   * Computed server-side from the RAW values, before masking. Without it a
   * redacted field that changed and one that did not both render `••• → •••`,
   * and the diff would lie in the one place it matters most.
   */
  changedKeys: string[];
  redactedKeys: string[];
};

/**
 * The entity filter offered by the UI. Must track the trigger list in
 * `20260726043523_audit_log_append_only_and_coverage.sql` — a table that is
 * audited but missing here is invisible to the only screen that reads the log.
 */
export const AUDIT_ENTITIES = [
  "mark",
  "exam_result",
  "fee_invoice",
  "fee_payment",
  "fee_mapping",
  "digital_transaction",
  "ledger_entry",
  "student",
  "student_enrollment",
  "teacher",
  "guardian",
  "profile",
  "user_role",
  "role",
  "role_permission",
  "institution",
  "certificate_template",
  "testimonial",
  "transfer_certificate",
  "sms_campaign",
  "migration_batch",
  "setting",
] as const;

/**
 * LOWERCASE, and that is a bug fix.
 *
 * This list read `["INSERT","UPDATE","DELETE"]` while `private.audit_trigger`
 * has always written `insert` / `update` / `delete`. `eq("action","UPDATE")`
 * matches nothing in a 1,918-row table, so the action filter returned an empty
 * result for every value it offered and read as "no records match" rather than
 * as a broken control. Nothing failed; it just never worked.
 *
 * The non-CRUD entries below are written by the account RPCs
 * (`fn_complete_user_invite`, `fn_set_user_status`, `fn_admin_revoke_sessions`,
 * `fn_authorize_account_action`, `fn_admin_reset_mfa`) and had no way to be
 * filtered for at all.
 */
export const AUDIT_ACTIONS = [
  "insert",
  "update",
  "delete",
  "invite",
  "suspend",
  "reactivate",
  "password_reset",
  "revoke_sessions",
  "resend_invite",
  "admin_reset",
] as const;

export const AUDIT_PAGE_SIZE = 25;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A record id pasted into the search box means "the history of this record". */
export const isRecordId = (value: string) => UUID.test(value.trim());

export type AuditQuery = {
  page?: number;
  entity?: string;
  action?: string;
  entityId?: string;
  /** `YYYY-MM-DD`, inclusive at both ends. */
  from?: string;
  to?: string;
  changedBy?: string;
  dir?: "asc" | "desc";
};

const str = (v: unknown) => (typeof v === "string" ? v : null);
const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : null);
const list = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);

export async function fetchAuditLog(
  supabase: BrowserClient,
  { page = 1, entity, action, entityId, from, to, changedBy, dir = "desc" }: AuditQuery,
): Promise<{ rows: AuditLogRow[]; total: number }> {
  const { data, error } = await supabase.rpc("fn_audit_log", {
    p_page: page,
    p_per_page: AUDIT_PAGE_SIZE,
    p_entity: entity || undefined,
    p_action: action || undefined,
    p_entity_id: entityId && isRecordId(entityId) ? entityId.trim() : undefined,
    p_from: from || undefined,
    p_to: to || undefined,
    p_changed_by: changedBy || undefined,
    p_dir: dir,
  });
  if (error) throw error;

  const payload = (data ?? {}) as { rows?: unknown[]; total?: number };
  const rows = (payload.rows ?? []).map((raw) => {
    const r = raw as Record<string, unknown>;
    return {
      id: String(r.id),
      entity: String(r.entity),
      entityId: str(r.entity_id),
      action: String(r.action),
      at: String(r.at),
      changedById: str(r.changed_by),
      changedByName: str(r.changed_by_name),
      severity: String(r.severity ?? "normal"),
      before: obj(r.before),
      after: obj(r.after),
      changedKeys: list(r.changed_keys),
      redactedKeys: list(r.redacted_keys),
    } satisfies AuditLogRow;
  });

  return { rows, total: payload.total ?? 0 };
}

/** Who has ever changed anything here — the "changed by" filter's options. */
export async function fetchAuditActors(supabase: BrowserClient): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase.rpc("fn_audit_actors");
  if (error) throw error;
  return ((data ?? []) as { id: string; name: string }[]).map((r) => ({ id: String(r.id), name: String(r.name) }));
}

/**
 * Unmask one record. The RPC writes an `audit.reveal` entry to `access_log`
 * before it answers — reading someone's personal data is itself an event, and
 * a redaction nobody can bypass is a redaction nobody uses.
 */
export async function revealAuditRecord(
  supabase: BrowserClient,
  id: string,
): Promise<{ before: Record<string, unknown> | null; after: Record<string, unknown> | null }> {
  const { data, error } = await supabase.rpc("fn_audit_reveal", { p_id: id });
  if (error) throw new Error(error.message);
  const r = (data ?? {}) as Record<string, unknown>;
  return { before: obj(r.before), after: obj(r.after) };
}

/**
 * Where a record's own screen lives, for the deep link out of an audit row
 * (audit S-11.9). Only the entities that HAVE a screen keyed by that id are
 * listed; a link that 404s is worse than no link.
 */
export function recordHref(entity: string, entityId: string | null): string | null {
  if (!entityId) return null;
  switch (entity) {
    case "student":
    case "student_enrollment":
      return `/admin/student/update-basic?id=${entityId}`;
    case "teacher":
      return `/admin/teacher/update-profile?id=${entityId}`;
    case "profile":
    case "user_role":
      return `/admin/core/user-list?q=${entityId}`;
    case "fee_invoice":
    case "fee_payment":
      return `/admin/fee/day-book?id=${entityId}`;
    case "sms_campaign":
      return `/admin/sms-notice/history?id=${entityId}`;
    case "setting":
      return "/admin/core/basic-config";
    default:
      return null;
  }
}
