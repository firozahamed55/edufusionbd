// Supabase data access for the Audit Log screen. RLS-scoped via audit_policy
// (institution_id match or platform admin) — enforced on the audit_log table
// itself, not re-implemented here.
import type { BrowserClient } from "@/shared/services/supabase/types";

export type AuditLogRow = {
  id: string;
  entity: string;
  entityId: string | null;
  action: string;
  at: string;
  changedByName: string | null;
  before: unknown;
  after: unknown;
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

const PAGE_SIZE = 25;

export async function fetchAuditLog(
  supabase: BrowserClient,
  { page = 1, entity }: { page?: number; entity?: string },
): Promise<{ rows: AuditLogRow[]; total: number }> {
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("audit_log")
    .select("id, entity, entity_id, action, at, before, after, changed_by:profile(full_name)", {
      count: "exact",
    })
    .order("at", { ascending: false })
    .range(from, to);

  if (entity) query = query.eq("entity", entity);

  const { data, error, count } = await query;
  if (error) throw error;

  const rows = (data ?? []).map((r) => ({
    id: r.id,
    entity: r.entity,
    entityId: r.entity_id,
    action: r.action,
    at: r.at,
    changedByName: r.changed_by?.full_name ?? null,
    before: r.before,
    after: r.after,
  }));

  return { rows, total: count ?? 0 };
}
