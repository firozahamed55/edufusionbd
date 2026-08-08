"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, History, ExternalLink, EyeOff } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import {
  Table, THead, TBody, TR, TH, TD, TableEmpty, SortableTH,
  Badge, ErrorState, NoAccessState, Pagination, Modal, PageHeader, LiveRegion, DataToolbar, Button, JsonDiff,
} from "@/shared/ui";
import { useDataScreen } from "@/shared/lib/useDataScreen";
import { exportCsv } from "@/shared/lib/exportCsv";
import { formatDateTime, localDay } from "@/shared/lib/format";
import { useErrorMessage, classifyError } from "@/shared/services/errors";
import { useAuditLog, useAuditActors, useRevealAudit } from "./logic/useAuditLog";
import {
  AUDIT_ENTITIES, AUDIT_ACTIONS, AUDIT_PAGE_SIZE, isRecordId, recordHref, type AuditLogRow,
} from "./logic/api";

/**
 * Core · Audit Log — every recorded change, on the data-interaction contract
 * (SRA A-0.1), and as of the settings audit (M-14) an instrument you can
 * actually investigate with rather than a list you can only scroll.
 *
 * WHAT WAS MISSING, AND WHY IT MATTERED.
 *
 * - **Date range.** "What changed last week" is the first question of every
 *   investigation and it could not be asked.
 * - **Actor.** "What did this person do" was the second, and the join to
 *   `profile` was already in the query — only the filter was absent.
 * - **A diff.** Two `<pre>` dumps of forty keys at 12 px, side by side. Finding
 *   the one that changed was manual, every single time.
 * - **The action filter never worked at all.** It offered `INSERT` / `UPDATE` /
 *   `DELETE`; the trigger writes `insert` / `update` / `delete`. Every value it
 *   offered matched zero of 1,918 rows and rendered as "no records found".
 * - **PII.** `before`/`after` on a student row is the complete record, shown
 *   verbatim to anyone with `audit.read`, with no record of who looked. It is
 *   now masked by the RPC, and revealing writes an `access_log` entry.
 *
 * Server-paged deliberately: the log only ever grows, so `applyClientList`
 * would be wrong and "export all" would silently mean "export page 1".
 *
 * The search box takes a **record id**, not free text. `audit_log.entity_id` is
 * a uuid and `before`/`after` are jsonb — there is no text column worth an
 * `ilike`.
 */

const ENTITY_LABEL: Record<string, { bn: string; en: string }> = {
  mark: { bn: "মার্ক", en: "Marks" },
  exam_result: { bn: "ফলাফল", en: "Exam Result" },
  fee_invoice: { bn: "ফি চালান", en: "Fee Invoice" },
  fee_payment: { bn: "ফি আদায়", en: "Fee Payment" },
  fee_mapping: { bn: "ফি ম্যাপিং", en: "Fee Mapping" },
  digital_transaction: { bn: "ডিজিটাল লেনদেন", en: "Digital Transaction" },
  ledger_entry: { bn: "লেজার", en: "Ledger Entry" },
  student: { bn: "শিক্ষার্থী", en: "Student" },
  student_enrollment: { bn: "ভর্তি", en: "Enrollment" },
  teacher: { bn: "শিক্ষক", en: "Teacher" },
  guardian: { bn: "অভিভাবক", en: "Guardian" },
  profile: { bn: "ব্যবহারকারী", en: "User" },
  user_role: { bn: "ভূমিকা বরাদ্দ", en: "Role Assignment" },
  role: { bn: "ভূমিকা", en: "Role" },
  role_permission: { bn: "অনুমতি", en: "Permission" },
  institution: { bn: "প্রতিষ্ঠান", en: "Institution" },
  certificate_template: { bn: "সনদ টেমপ্লেট", en: "Certificate Template" },
  testimonial: { bn: "প্রশংসাপত্র", en: "Testimonial" },
  transfer_certificate: { bn: "ছাড়পত্র", en: "Transfer Certificate" },
  sms_campaign: { bn: "এসএমএস", en: "SMS Campaign" },
  migration_batch: { bn: "মাইগ্রেশন", en: "Migration" },
  setting: { bn: "সেটিংস", en: "Setting" },
};

/**
 * Every entity the filter offers must have a label. It did not: `AUDIT_ENTITIES`
 * listed 22 and this map held 6, and the `<option>` list read `.bn` without a
 * guard — so the screen threw on render the moment the list grew past
 * `migration_batch`. Row rendering had the `?.` the options were missing.
 */
const label = (entity: string) => ENTITY_LABEL[entity] ?? { bn: entity, en: entity };

const ACTION_LABEL: Record<string, { bn: string; en: string }> = {
  insert: { bn: "তৈরি", en: "Created" },
  update: { bn: "পরিবর্তন", en: "Updated" },
  delete: { bn: "মুছে ফেলা", en: "Deleted" },
  invite: { bn: "আমন্ত্রণ", en: "Invited" },
  suspend: { bn: "স্থগিত", en: "Suspended" },
  reactivate: { bn: "পুনঃসক্রিয়", en: "Reactivated" },
  password_reset: { bn: "পাসওয়ার্ড রিসেট", en: "Password reset" },
  revoke_sessions: { bn: "সেশন বাতিল", en: "Sessions revoked" },
  resend_invite: { bn: "আমন্ত্রণ পুনঃপ্রেরণ", en: "Invite resent" },
  admin_reset: { bn: "এমএফএ রিসেট", en: "MFA reset" },
};
const actionLabel = (a: string) => ACTION_LABEL[a] ?? { bn: a, en: a };

const ACTION_TONE: Record<string, "success" | "warning" | "danger"> = {
  insert: "success",
  update: "warning",
  delete: "danger",
  invite: "success",
  suspend: "danger",
  reactivate: "success",
  revoke_sessions: "danger",
  admin_reset: "danger",
};

const filterClass =
  "rounded-lg border border-border-strong bg-surface px-3 py-2.5 text-meta font-medium text-text-secondary";

export function AuditLogScreen() {
  const { t, n } = useT();
  const msg = useErrorMessage();
  const [selected, setSelected] = useState<AuditLogRow | null>(null);

  const ds = useDataScreen({
    filters: { entity: "", action: "", from: "", to: "", changedBy: "" },
    perPage: AUDIT_PAGE_SIZE,
  });
  const { entity, action, from, to, changedBy } = ds.filters;
  const recordId = isRecordId(ds.debouncedQ) ? ds.debouncedQ.trim() : "";
  const badSearch = ds.debouncedQ.trim() !== "" && !recordId;

  const { data, isLoading, isError, error, refetch } = useAuditLog({
    page: ds.page,
    entity: entity || undefined,
    action: action || undefined,
    entityId: recordId || undefined,
    from: from || undefined,
    to: to || undefined,
    changedBy: changedBy || undefined,
    dir: ds.sort?.key === "at" && ds.sort.dir === "asc" ? "asc" : "desc",
  });
  const actors = useAuditActors();

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const noAccess = isError && classifyError(error) === "forbidden";

  return (
    <div className="flex flex-col gap-5">
      <LiveRegion
        message={
          isLoading
            ? t("লোড হচ্ছে", "Loading audit log")
            : t(`${n(total)} টি রেকর্ড পাওয়া গেছে`, `${total} audit records`)
        }
      />

      <PageHeader
        crumbs={[{ label: t("সেটিংস", "Settings"), href: "/admin/core" }, { label: t("পরিবর্তনের ইতিহাস", "Audit Log") }]}
        title={t("পরিবর্তনের ইতিহাস", "Audit Log")}
        subtitle={t("কে, কখন, কী পরিবর্তন করেছে তার সম্পূর্ণ তালিকা", "Every recorded change — who, when, and what")}
      />

      <DataToolbar
        q={ds.q}
        onQChange={ds.setQ}
        placeholder={t("রেকর্ড আইডি দিন", "Paste a record ID")}
        searchLabel={t("রেকর্ড আইডি দিয়ে ইতিহাস খুঁজুন", "Find the history of one record by ID")}
        isFiltered={ds.isFiltered}
        onReset={ds.reset}
        filters={
          <>
            <select
              value={entity}
              onChange={(e) => ds.setFilter("entity", e.target.value)}
              aria-label={t("বিভাগ ফিল্টার", "Filter by entity")}
              className={filterClass}
            >
              <option value="">{t("সব বিভাগ", "All entities")}</option>
              {AUDIT_ENTITIES.map((e) => (
                <option key={e} value={e}>{t(label(e).bn, label(e).en)}</option>
              ))}
            </select>
            <select
              value={action}
              onChange={(e) => ds.setFilter("action", e.target.value)}
              aria-label={t("অ্যাকশন ফিল্টার", "Filter by action")}
              className={filterClass}
            >
              <option value="">{t("সব অ্যাকশন", "All actions")}</option>
              {AUDIT_ACTIONS.map((a) => (
                <option key={a} value={a}>{t(actionLabel(a).bn, actionLabel(a).en)}</option>
              ))}
            </select>
            {/* Audit M-14: "what changed last week" and "what did this person
                do" are the two questions an investigation starts with, and
                neither could be asked. */}
            <select
              value={changedBy}
              onChange={(e) => ds.setFilter("changedBy", e.target.value)}
              aria-label={t("পরিবর্তনকারী ফিল্টার", "Filter by who changed it")}
              className={filterClass}
            >
              <option value="">{t("যে কেউ", "Anyone")}</option>
              {(actors.data ?? []).map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-meta text-text-secondary">
              <span className="sr-only">{t("শুরুর তারিখ", "From date")}</span>
              <input
                type="date"
                value={from}
                max={to || undefined}
                onChange={(e) => ds.setFilter("from", e.target.value)}
                aria-label={t("শুরুর তারিখ", "From date")}
                className={filterClass}
              />
            </label>
            <label className="flex items-center gap-1.5 text-meta text-text-secondary">
              <span className="sr-only">{t("শেষ তারিখ", "To date")}</span>
              <input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => ds.setFilter("to", e.target.value)}
                aria-label={t("শেষ তারিখ", "To date")}
                className={filterClass}
              />
            </label>
          </>
        }
        // Export is of this page only, and says so. The log is unbounded; an
        // "export all" here would be a promise the fetch cannot keep. Values
        // are the masked ones — an export is not a reveal.
        onExportPage={() =>
          exportCsv(
            `audit-log-${localDay()}.csv`,
            rows.map((r) => ({
              When: formatDateTime(r.at),
              Entity: label(r.entity).en,
              RecordId: r.entityId ?? "",
              Action: r.action,
              Severity: r.severity,
              ChangedBy: r.changedByName ?? "System",
              ChangedFields: r.changedKeys.join(" "),
            })),
            { kind: "core.audit_log", params: { q: ds.debouncedQ, entity, action, from, to, changedBy, page: ds.page, scope: "page" } },
          )
        }
        exportPageCount={rows.length}
      />

      {badSearch ? (
        <p role="status" className="rounded-lg border border-border-strong bg-sunken px-4 py-3 text-meta text-text-secondary">
          {t(
            "অনুসন্ধান বাক্সে সম্পূর্ণ রেকর্ড আইডি দিন — নাম বা শব্দ দিয়ে খোঁজা যায় না।",
            "The search box takes a full record ID — the log has no searchable text column.",
          )}
        </p>
      ) : null}

      {noAccess ? (
        <NoAccessState
          title={t("এই পাতা দেখার অনুমতি নেই", "You do not have access to this page")}
          description={t(
            "পরিবর্তনের ইতিহাস দেখতে অডিট পড়ার অনুমতি প্রয়োজন।",
            "Reading the change history needs audit access.",
          )}
          permission="audit.read"
        />
      ) : isError ? (
        <ErrorState
          title={t("তথ্য লোড করা যায়নি", "Couldn't load the audit log")}
          description={msg(error)}
          action={<Button onClick={() => refetch()}>{t("পুনরায় চেষ্টা", "Retry")}</Button>}
        />
      ) : (
        <>
          <Table minWidth={900}>
            <THead>
              <TR>
                <SortableTH sortKey="at" sort={ds.sort} onSort={ds.setSort}>{t("সময়", "When")}</SortableTH>
                <TH>{t("বিভাগ", "Entity")}</TH>
                <TH>{t("অ্যাকশন", "Action")}</TH>
                <TH>{t("পরিবর্তনকারী", "Changed by")}</TH>
                <TH>{t("পরিবর্তিত ক্ষেত্র", "Fields")}</TH>
                <TH className="w-14"><span className="sr-only">{t("বিস্তারিত", "Details")}</span></TH>
              </TR>
            </THead>
            <TBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TR key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <TD key={j}><span className="block h-5 animate-pulse rounded bg-sunken" /></TD>
                    ))}
                  </TR>
                ))
              ) : rows.length === 0 ? (
                <TableEmpty
                  colSpan={6}
                  icon={<History size={22} />}
                  title={t("কোনো রেকর্ড পাওয়া যায়নি", "No audit records found")}
                  description={ds.isFiltered ? t("ফিল্টার সরিয়ে দেখুন", "Try clearing the filters") : undefined}
                />
              ) : (
                rows.map((r) => (
                  <TR key={r.id}>
                    <TD className="text-meta text-text-secondary">{formatDateTime(r.at)}</TD>
                    <TD>{t(label(r.entity).bn, label(r.entity).en)}</TD>
                    <TD className="whitespace-nowrap">
                      <Badge tone={ACTION_TONE[r.action] ?? "info"}>{t(actionLabel(r.action).bn, actionLabel(r.action).en)}</Badge>
                      {/* S-11.10: `fn_admin_reset_mfa` has written
                          `severity: 'high'` since it shipped and nothing
                          surfaced it. */}
                      {r.severity === "high" ? (
                        <span className="ml-1.5 align-middle"><Badge tone="danger">{t("উচ্চ", "High")}</Badge></span>
                      ) : null}
                    </TD>
                    <TD className="text-meta text-text-secondary">{r.changedByName ?? t("সিস্টেম", "System")}</TD>
                    <TD className="max-w-[16rem] truncate font-latin text-meta text-text-muted" title={r.changedKeys.join(", ")}>
                      {r.changedKeys.length > 0 ? r.changedKeys.join(", ") : "—"}
                    </TD>
                    <TD className="text-center">
                      <button
                        onClick={() => setSelected(r)}
                        aria-label={t("বিস্তারিত দেখুন", "View details")}
                        className="grid size-8 place-items-center rounded-md text-text-muted hover:bg-sunken"
                      >
                        <Eye size={16} />
                      </button>
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>

          {total > ds.perPage ? (
            <Pagination
              label={t(
                `${n(ds.from)}–${n(ds.to(total))} দেখানো হচ্ছে · মোট ${n(total)} টি`,
                `Showing ${ds.from}-${ds.to(total)} of ${total}`,
              )}
              pages={ds.pages(total)}
              current={ds.page}
              onPageChange={ds.setPage}
            />
          ) : null}
        </>
      )}

      {selected ? <DetailModal row={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

function DetailModal({ row, onClose }: { row: AuditLogRow; onClose: () => void }) {
  const { t, n } = useT();
  const msg = useErrorMessage();
  const reveal = useRevealAudit();
  const [revealed, setRevealed] = useState<{ before: Record<string, unknown> | null; after: Record<string, unknown> | null } | null>(null);

  const href = recordHref(row.entity, row.entityId);
  const before = revealed?.before ?? row.before;
  const after = revealed?.after ?? row.after;

  return (
    <Modal open onClose={onClose} title={t("পরিবর্তনের বিস্তারিত", "Change details")}>
      <div className="flex flex-col gap-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-meta">
          <dt className="text-text-muted">{t("সময়", "When")}</dt>
          <dd className="text-text-primary">{formatDateTime(row.at)}</dd>
          <dt className="text-text-muted">{t("পরিবর্তনকারী", "Changed by")}</dt>
          <dd className="text-text-primary">{row.changedByName ?? t("সিস্টেম", "System")}</dd>
          <dt className="text-text-muted">{t("রেকর্ড আইডি", "Record ID")}</dt>
          <dd className="break-all font-latin text-text-primary">{row.entityId ?? "—"}</dd>
        </dl>

        {/* S-11.9: an audit row named a record and gave no way to open it. */}
        {href ? (
          <Link href={href} className="inline-flex items-center gap-1.5 text-meta font-medium text-primary hover:underline">
            <ExternalLink size={14} /> {t("এই রেকর্ডটি খুলুন", "Open this record")}
          </Link>
        ) : null}

        <JsonDiff
          before={before}
          after={after}
          changedKeys={row.changedKeys}
          redactedKeys={revealed ? [] : row.redactedKeys}
          labels={{
            changed: t("যা পরিবর্তিত হয়েছে", "What changed"),
            unchanged: (count) => t(`${n(String(count))} টি অপরিবর্তিত ক্ষেত্র`, `${count} unchanged fields`),
            nothing: t("কোনো ক্ষেত্র পরিবর্তিত হয়নি", "No fields changed"),
            redacted: t("গোপন করা", "hidden"),
            added: t("নতুন", "added"),
            removed: t("সরানো", "removed"),
          }}
        />

        {row.redactedKeys.length > 0 && !revealed ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border-strong bg-sunken px-3 py-2.5">
            <p className="flex-1 text-meta text-text-secondary">
              {t(
                "ব্যক্তিগত তথ্য লুকানো আছে। প্রকাশ করলে কে দেখেছে তা লগে লেখা হবে।",
                "Personal data is hidden. Revealing it records who looked.",
              )}
            </p>
            <Button
              variant="secondary"
              disabled={reveal.isPending}
              onClick={() =>
                reveal.mutate(row.id, {
                  onSuccess: (r) => setRevealed(r),
                })
              }
            >
              <EyeOff size={15} /> {reveal.isPending ? t("প্রকাশ হচ্ছে…", "Revealing…") : t("প্রকাশ করুন", "Reveal")}
            </Button>
          </div>
        ) : null}
        {reveal.isError ? (
          <p role="alert" className="text-meta text-danger-fg">{msg(reveal.error)}</p>
        ) : null}
      </div>
    </Modal>
  );
}
