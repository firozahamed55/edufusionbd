// Supabase data access for the Audit Log screen. RLS-scoped via audit_policy
// (institution_id match or platform admin) — enforced on the audit_log table
// itself, not re-implemented here.
import type { BrowserClient } from "@/shared/services/supabase/types";

export type AuditSeverity = "high" | "medium" | "low";

export type AuditActor = { id: string; name: string };

export type AuditLogRow = {
  id: string;
  entity: string;
  entityId: string | null;
  action: string;
  at: string;
  changedById: string | null;
  changedByName: string | null;
  before: unknown;
  after: unknown;
  /** From `after->>'severity'`, where the RPC that wrote the row set one. */
  severity: AuditSeverity | null;
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

export const AUDIT_ACTIONS = ["INSERT", "UPDATE", "DELETE"] as const;

export const AUDIT_PAGE_SIZE = 25;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A record id pasted into the search box means "the history of this record". */
export const isRecordId = (value: string) => UUID.test(value.trim());

/**
 * A `YYYY-MM-DD` from a date input, as the timestamptz bound the column needs.
 *
 * `to` is exclusive-of-the-next-day rather than `<= to`: `at` is a timestamptz
 * and `to = '2026-04-30'` parses as midnight, so an inclusive comparison
 * silently drops everything that happened ON the last day of the range — the
 * single most common off-by-one in a date filter, and one that looks like
 * missing data rather than like a bug.
 */
const dayStart = (day: string) => `${day}T00:00:00`;
const dayAfter = (day: string) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return `${d.toISOString().slice(0, 10)}T00:00:00`;
};

/** `YYYY-MM-DD`, the only shape `<input type="date">` produces. */
export const isDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value.trim());

export type AuditLogParams = {
  page?: number;
  entity?: string;
  action?: string;
  entityId?: string;
  /** Inclusive lower bound, `YYYY-MM-DD` (audit M-14, S-11.1). */
  from?: string;
  /** Inclusive upper bound, `YYYY-MM-DD` — see `dayAfter`. */
  to?: string;
  /** Actor profile id (audit M-14, S-11.2). */
  changedBy?: string;
  dir?: "asc" | "desc";
};

export async function fetchAuditLog(
  supabase: BrowserClient,
  { page = 1, entity, action, entityId, from: fromDay, to: toDay, changedBy, dir = "desc" }: AuditLogParams,
): Promise<{ rows: AuditLogRow[]; total: number }> {
  const from = (page - 1) * AUDIT_PAGE_SIZE;
  const to = from + AUDIT_PAGE_SIZE - 1;

  let query = supabase
    .from("audit_log")
    .select("id, entity, entity_id, action, at, before, after, changed_by, actor:profile(full_name)", {
      count: "exact",
    })
    .order("at", { ascending: dir === "asc" })
    .range(from, to);

  if (entity) query = query.eq("entity", entity);
  if (action) query = query.eq("action", action);
  // `entity_id` is a uuid column, so this is an equality filter and never a
  // partial match. The caller guards with `isRecordId` — a malformed uuid sent
  // to PostgREST is a 400, not an empty result.
  if (entityId && isRecordId(entityId)) query = query.eq("entity_id", entityId.trim());
  if (fromDay && isDay(fromDay)) query = query.gte("at", dayStart(fromDay.trim()));
  if (toDay && isDay(toDay)) query = query.lt("at", dayAfter(toDay.trim()));
  if (changedBy && isRecordId(changedBy)) query = query.eq("changed_by", changedBy.trim());

  const { data, error, count } = await query;
  if (error) throw error;

  const rows = (data ?? []).map((r) => ({
    id: r.id,
    entity: r.entity,
    entityId: r.entity_id,
    action: r.action,
    at: r.at,
    changedById: r.changed_by,
    changedByName: r.actor?.full_name ?? null,
    before: r.before,
    after: r.after,
    severity: readSeverity(r.after),
  }));

  return { rows, total: count ?? 0 };
}

/**
 * The severity an RPC wrote into its own audit payload (audit S-11.10).
 *
 * `fn_admin_reset_mfa` has written `severity: 'high'` since it shipped and no
 * screen has ever shown it, so the highest-consequence entry in the log looked
 * exactly like a typo correction. Read defensively: `after` is open jsonb and
 * most rows are trigger-written table snapshots with no severity at all.
 */
function readSeverity(after: unknown): AuditSeverity | null {
  if (typeof after !== "object" || after === null) return null;
  const value = (after as Record<string, unknown>).severity;
  return value === "high" || value === "medium" || value === "low" ? value : null;
}

/**
 * Distinct actors appearing in this institution's log, for the "changed by"
 * filter. An RPC rather than a `profile` read: the list should be the people
 * who are IN the log, not every account that exists, and `audit.read` alone
 * does not carry permission to enumerate users.
 */
export async function fetchAuditActors(supabase: BrowserClient): Promise<AuditActor[]> {
  const { data, error } = await supabase.rpc("fn_audit_actors");
  if (error) throw error;
  return (data as AuditActor[]) ?? [];
}

/** Note that someone revealed the redacted fields of one entry (audit S-11.4). */
export async function logAuditReveal(supabase: BrowserClient, auditId: string): Promise<void> {
  const { error } = await supabase.rpc("fn_log_audit_reveal", { p_audit_id: auditId });
  if (error) throw error;
}
