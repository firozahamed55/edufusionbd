// Supabase data access for the Audit Log screen. RLS-scoped via audit_policy
// (institution_id match or platform admin) — enforced on the audit_log table
// itself, not re-implemented here.
import type { BrowserClient } from "@/shared/services/supabase/types";

export type AuditLogRow = {
  id: string;
  entity: string;
  entityId: string;
  action: string;
  at: string;
  changedByName: string | null;
  before: unknown;
  after: unknown;
};

export const AUDIT_ENTITIES = [
  "mark",
  "exam_result",
  "fee_invoice",
  "student_enrollment",
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

  type Raw = {
    id: string;
    entity: string;
    entity_id: string;
    action: string;
    at: string;
    before: unknown;
    after: unknown;
    changed_by: { full_name: string | null } | null;
  };
  const rows = ((data ?? []) as unknown as Raw[]).map((r) => ({
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
