"use client";

import { useState } from "react";
import { Eye, History } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import {
  Table, THead, TBody, TR, TH, TD, TableEmpty, SortableTH,
  Badge, ErrorState, Pagination, Modal, PageHeader, LiveRegion, DataToolbar, Button,
} from "@/shared/ui";
import { useDataScreen } from "@/shared/lib/useDataScreen";
import { exportCsv } from "@/shared/lib/exportCsv";
import { formatDateTime, localDay } from "@/shared/lib/format";
import { useAuditLog } from "./logic/useAuditLog";
import { AUDIT_ENTITIES, AUDIT_ACTIONS, AUDIT_PAGE_SIZE, isRecordId, type AuditLogRow } from "./logic/api";

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

const filterClass =
  "rounded-lg border border-border-strong bg-surface px-3 py-2.5 text-meta font-medium text-text-secondary";

export function AuditLogScreen() {
  const { t, n } = useT();
  const [selected, setSelected] = useState<AuditLogRow | null>(null);

  const ds = useDataScreen({ filters: { entity: "", action: "" }, perPage: AUDIT_PAGE_SIZE });
  const { entity, action } = ds.filters;
  const recordId = isRecordId(ds.debouncedQ) ? ds.debouncedQ.trim() : "";
  const badSearch = ds.debouncedQ.trim() !== "" && !recordId;

  const { data, isLoading, isError, refetch } = useAuditLog({
    page: ds.page,
    entity: entity || undefined,
    action: action || undefined,
    entityId: recordId || undefined,
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
            })),
            { kind: "core.audit_log" },
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
                <TH>{t("পরিবর্তনকারী", "Changed by")}</TH>
                <TH className="w-14"><span className="sr-only">{t("বিস্তারিত", "Details")}</span></TH>
              </TR>
            </THead>
            <TBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TR key={i}>
                    {Array.from({ length: 5 }).map((__, j) => (
                      <TD key={j}><span className="block h-5 animate-pulse rounded bg-sunken" /></TD>
                    ))}
                  </TR>
                ))
              ) : rows.length === 0 ? (
                <TableEmpty
                  colSpan={5}
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

      <Modal open={selected !== null} onClose={() => setSelected(null)} title={t("পরিবর্তনের বিস্তারিত", "Change details")}>
        {selected ? (
          <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-meta">
              <dt className="text-text-muted">{t("সময়", "When")}</dt>
              <dd className="text-text-primary">{formatDateTime(selected.at)}</dd>
              <dt className="text-text-muted">{t("রেকর্ড আইডি", "Record ID")}</dt>
              <dd className="break-all font-latin text-text-primary">{selected.entityId ?? "—"}</dd>
            </dl>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-text-muted">{t("আগে", "Before")}</p>
                <pre className="max-h-64 overflow-auto rounded-lg bg-sunken p-3 text-xs">
                  {JSON.stringify(selected.before, null, 2) ?? "—"}
                </pre>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-text-muted">{t("পরে", "After")}</p>
                <pre className="max-h-64 overflow-auto rounded-lg bg-sunken p-3 text-xs">
                  {JSON.stringify(selected.after, null, 2) ?? "—"}
                </pre>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
