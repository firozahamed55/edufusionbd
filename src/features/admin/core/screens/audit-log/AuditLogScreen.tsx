"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, History, ExternalLink } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import {
  Table, THead, TBody, TR, TH, TD, TableEmpty, SortableTH,
  Badge, ErrorState, Pagination, Modal, PageHeader, LiveRegion, DataToolbar, Button,
  JsonDiff, buttonClass,
} from "@/shared/ui";
import { useDataScreen } from "@/shared/lib/useDataScreen";
import { exportCsv } from "@/shared/lib/exportCsv";
import { formatDateTime, localDay } from "@/shared/lib/format";
import { diffJson } from "@/shared/lib/jsonDiff";
import { countRedactable } from "@/shared/lib/auditRedaction";
import { useAuditLog, useAuditActors, useLogAuditReveal } from "./logic/useAuditLog";
import { AUDIT_ENTITIES, AUDIT_ACTIONS, AUDIT_PAGE_SIZE, isRecordId, type AuditLogRow, type AuditSeverity } from "./logic/api";

/**
 * Core · Audit Log — every recorded change, on the data-interaction contract
 * (SRA A-0.1). Entity, action and page now live in the URL, so "show me who
 * deleted fee invoices last week" is a link someone can send to the head
 * teacher rather than four clicks they have to describe.
 *
 * Server-paged deliberately: the log only ever grows, so `applyClientList`
 * would be wrong and "export all" would silently mean "export page 1".
 *
 * The search box takes a **record id**, not free text. `audit_log.entity_id` is
 * a uuid and `before`/`after` are jsonb — there is no text column worth an
 * `ilike`. Pasting a record id gives the per-record change timeline the SRA
 * notes is missing (A-2.2), and it is what the profile screens link to.
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

const ACTION_TONE: Record<string, "success" | "warning" | "danger"> = {
  INSERT: "success",
  UPDATE: "warning",
  DELETE: "danger",
};

const SEVERITY_TONE: Record<AuditSeverity, "danger" | "warning" | "info"> = {
  high: "danger",
  medium: "warning",
  low: "info",
};

/**
 * Where a record's own screen lives, if it has one (audit S-11.9).
 *
 * Two entries, not twenty-two, and that is the honest answer rather than a
 * stub: `/admin/student/profile?id=` and `/admin/teacher/profile?id=` are the
 * only routes in the product that take a record id and open that record.
 * Everything else — a fee invoice, a mark, a role grant — is reachable only
 * through a list screen that has no way to be told which row to show. Adding
 * those routes is screen work, not audit-log work; linking to a list and
 * hoping the operator finds the row would be worse than the "—" this returns.
 */
function recordHref(entity: string, id: string | null): string | null {
  if (!id) return null;
  if (entity === "student") return `/admin/student/profile?id=${id}`;
  if (entity === "teacher") return `/admin/teacher/profile?id=${id}`;
  return null;
}

const filterClass =
  "rounded-lg border border-border-strong bg-surface px-3 py-2.5 text-meta font-medium text-text-secondary";

export function AuditLogScreen() {
  const { t, n } = useT();
  const [selected, setSelected] = useState<AuditLogRow | null>(null);

  // `from`, `to` and `changedBy` join the URL-persisted filter set, so "what
  // did the accountant change last week" is a link (audit M-14, S-11.1/S-11.2).
  const ds = useDataScreen({
    filters: { entity: "", action: "", from: "", to: "", changedBy: "" },
    perPage: AUDIT_PAGE_SIZE,
  });
  const { entity, action, from, to, changedBy } = ds.filters;
  const recordId = isRecordId(ds.debouncedQ) ? ds.debouncedQ.trim() : "";
  const badSearch = ds.debouncedQ.trim() !== "" && !recordId;
  const actors = useAuditActors();

  const { data, isLoading, isError, refetch } = useAuditLog({
    page: ds.page,
    entity: entity || undefined,
    action: action || undefined,
    entityId: recordId || undefined,
    from: from || undefined,
    to: to || undefined,
    changedBy: changedBy || undefined,
    dir: ds.sort?.key === "at" && ds.sort.dir === "asc" ? "asc" : "desc",
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;

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
        crumbs={[{ label: t("সেটিংস", "Settings"), href: "/admin/core/basic-config" }, { label: t("পরিবর্তনের ইতিহাস", "Audit Log") }]}
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
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            {/* "What changed last week" is the most common audit question and
                it could not be asked at all (S-11.1). Two native date inputs
                rather than a bespoke range picker: they are keyboard- and
                screen-reader-complete for free, and the answer wanted here is
                a day, never a time. */}
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => ds.setFilter("from", e.target.value)}
              aria-label={t("এই তারিখ থেকে", "From date")}
              className={`${filterClass} font-latin`}
            />
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => ds.setFilter("to", e.target.value)}
              aria-label={t("এই তারিখ পর্যন্ত", "To date")}
              className={`${filterClass} font-latin`}
            />
            {/* S-11.2 — the join to `profile` was already in the query; only
                the filter was missing. */}
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
          </>
        }
        // Export is of this page only, and says so. The log is unbounded; an
        // "export all" here would be a promise the fetch cannot keep.
        onExportPage={() =>
          exportCsv(
            `audit-log-${localDay()}.csv`,
            rows.map((r) => ({
              When: formatDateTime(r.at),
              Entity: label(r.entity).en,
              RecordId: r.entityId ?? "",
              Action: r.action,
              ChangedBy: r.changedByName ?? "System",
              Severity: r.severity ?? "",
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

      {isError ? (
        <ErrorState
          title={t("তথ্য লোড করা যায়নি", "Couldn't load the audit log")}
          action={<Button onClick={() => refetch()}>{t("পুনরায় চেষ্টা", "Retry")}</Button>}
        />
      ) : (
        <>
          <Table minWidth={820}>
            <THead>
              <TR>
                <SortableTH sortKey="at" sort={ds.sort} onSort={ds.setSort}>{t("সময়", "When")}</SortableTH>
                <TH>{t("বিভাগ", "Entity")}</TH>
                <TH>{t("অ্যাকশন", "Action")}</TH>
                <TH className="w-28">{t("গুরুত্ব", "Severity")}</TH>
                <TH>{t("পরিবর্তনকারী", "Changed by")}</TH>
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
                    <TD><Badge tone={ACTION_TONE[r.action] ?? "info"}>{r.action}</Badge></TD>
                    <TD>
                      {r.severity ? (
                        <Badge tone={SEVERITY_TONE[r.severity]}>{severityLabel(r.severity, t)}</Badge>
                      ) : (
                        <span className="text-meta text-text-decorative">—</span>
                      )}
                    </TD>
                    <TD className="text-meta text-text-secondary">{r.changedByName ?? t("সিস্টেম", "System")}</TD>
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

      {selected ? <ChangeDetail row={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

const severityLabel = (s: AuditSeverity, t: (bn: string, en: string) => string) =>
  s === "high" ? t("উচ্চ", "High") : s === "medium" ? t("মাঝারি", "Medium") : t("নিম্ন", "Low");

/**
 * One entry, as what changed rather than as two JSON dumps (audit S-11.3,
 * S-11.4, S-11.5, S-11.9).
 *
 * Four findings close here. The `<pre>` pair becomes a field-level diff. The
 * personal fields inside it start masked, and unmasking writes an access-log
 * row before it happens. Severity — which `fn_admin_reset_mfa` has been
 * writing into its payload since it shipped, unread — gets a chip. And where
 * the record has a screen of its own, there is a link to it.
 */
function ChangeDetail({ row, onClose }: { row: AuditLogRow; onClose: () => void }) {
  const { t, n } = useT();
  const [revealed, setRevealed] = useState(false);
  const reveal = useLogAuditReveal();

  const { changes } = diffJson(row.before, row.after);
  const redactable = countRedactable(changes.map((c) => c.key));
  const href = recordHref(row.entity, row.entityId);

  /**
   * The log is written before the mask comes off, and the unmask waits for it.
   * If the write fails the fields stay hidden: a reveal nobody can account for
   * is the exact thing this is here to prevent.
   */
  function onReveal() {
    reveal.mutate(row.id, { onSuccess: () => setRevealed(true) });
  }

  return (
    <Modal open onClose={onClose} title={t("পরিবর্তনের বিস্তারিত", "Change details")}>
      <div className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-meta">
          <dt className="text-text-muted">{t("সময়", "When")}</dt>
          <dd className="text-text-primary">{formatDateTime(row.at)}</dd>
          <dt className="text-text-muted">{t("পরিবর্তনকারী", "Changed by")}</dt>
          <dd className="text-text-primary">{row.changedByName ?? t("সিস্টেম", "System")}</dd>
          <dt className="text-text-muted">{t("রেকর্ড আইডি", "Record ID")}</dt>
          <dd className="break-all font-latin text-text-primary">{row.entityId ?? "—"}</dd>
        </dl>

        {href ? (
          <Link href={href} className={buttonClass("secondary", "sm")}>
            <ExternalLink size={14} /> {t("রেকর্ডটি খুলুন", "Open this record")}
          </Link>
        ) : null}

        {redactable > 0 && !revealed ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-warning-fg/30 bg-warning-bg px-3 py-2.5">
            <p className="flex-1 text-meta text-warning-fg">
              {t(
                `${n(redactable)}টি ব্যক্তিগত তথ্যের ঘর লুকানো আছে। দেখলে সেটি অ্যাক্সেস লগে লেখা হবে।`,
                `${redactable} personal field(s) are hidden. Revealing them is written to the access log.`,
              )}
            </p>
            <Button variant="secondary" size="sm" onClick={onReveal} disabled={reveal.isPending}>
              {reveal.isPending ? t("লেখা হচ্ছে…", "Logging…") : t("দেখুন", "Reveal")}
            </Button>
          </div>
        ) : null}

        <JsonDiff
          before={row.before}
          after={row.after}
          revealed={revealed}
          labels={{
            changeCount: (count) => t(`${n(count)}টি ঘর বদলেছে`, `${count} field(s) changed`),
            noChanges: t("কোনো ঘরের মান বদলায়নি।", "No field values changed."),
            unchanged: (count) => t(`অপরিবর্তিত ${n(count)}টি ঘর`, `${count} unchanged field(s)`),
            kind: {
              added: t("যোগ", "added"),
              removed: t("বাদ", "removed"),
              changed: t("পরিবর্তিত", "changed"),
            },
          }}
        />
      </div>
    </Modal>
  );
}
