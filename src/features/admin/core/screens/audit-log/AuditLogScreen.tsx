"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import {
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  TableEmpty,
  Badge,
  ErrorState,
  Pagination,
  Modal,
} from "@/shared/ui";
import { useAuditLog } from "./logic/useAuditLog";
import { AUDIT_ENTITIES, type AuditLogRow } from "./logic/api";

const ENTITY_LABEL: Record<string, { bn: string; en: string }> = {
  mark: { bn: "মার্ক", en: "Marks" },
  exam_result: { bn: "ফলাফল", en: "Exam Result" },
  fee_invoice: { bn: "ফি চালান", en: "Fee Invoice" },
  student_enrollment: { bn: "ভর্তি", en: "Enrollment" },
  migration_batch: { bn: "মাইগ্রেশন", en: "Migration" },
  setting: { bn: "সেটিংস", en: "Setting" },
};

const ACTION_TONE: Record<string, "success" | "warning" | "danger"> = {
  INSERT: "success",
  UPDATE: "warning",
  DELETE: "danger",
};

const PER_PAGE = 25;

export function AuditLogScreen() {
  const { t } = useT();
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState("");
  const [selected, setSelected] = useState<AuditLogRow | null>(null);
  const { data, isLoading, isError, refetch } = useAuditLog(page, entity || undefined);

  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="flex flex-col gap-7">
      <div>
        <div className="flex items-center gap-1.5 text-[13px] text-text-muted">
          <span>{t("কোর সেটিংস", "Core Settings")}</span>
          <span>›</span>
          <span className="text-text-secondary">{t("পরিবর্তনের ইতিহাস", "Audit Log")}</span>
        </div>
        <h1 className="mt-1.5 text-[22px] font-bold text-text-primary">
          {t("পরিবর্তনের ইতিহাস", "Audit Log")}
        </h1>
        <p className="mt-1 text-[13px] text-text-muted">
          {t("কে, কখন, কী পরিবর্তন করেছে তার সম্পূর্ণ তালিকা", "Every recorded change — who, when, and what")}
        </p>
      </div>

      <select
        value={entity}
        onChange={(e) => {
          setEntity(e.target.value);
          setPage(1);
        }}
        aria-label={t("বিভাগ ফিল্টার", "Filter by entity")}
        className="w-fit rounded-lg border border-border-strong bg-surface px-3 py-2.5 text-[13px] font-medium text-text-secondary"
      >
        <option value="">{t("সব বিভাগ", "All entities")}</option>
        {AUDIT_ENTITIES.map((e) => (
          <option key={e} value={e}>
            {t(ENTITY_LABEL[e].bn, ENTITY_LABEL[e].en)}
          </option>
        ))}
      </select>

      {isError ? (
        <ErrorState
          title={t("তথ্য লোড করা যায়নি", "Couldn't load the audit log")}
          action={
            <button
              onClick={() => refetch()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-text-on-primary"
            >
              {t("পুনরায় চেষ্টা", "Retry")}
            </button>
          }
        />
      ) : (
        <>
          <Table minWidth={760}>
            <THead>
              <TR>
                <TH>{t("সময়", "When")}</TH>
                <TH>{t("বিভাগ", "Entity")}</TH>
                <TH>{t("অ্যাকশন", "Action")}</TH>
                <TH>{t("পরিবর্তনকারী", "Changed by")}</TH>
                <TH className="w-14">
                  <span className="sr-only">{t("বিস্তারিত", "Details")}</span>
                </TH>
              </TR>
            </THead>
            <TBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TR key={i}>
                    {Array.from({ length: 5 }).map((__, j) => (
                      <TD key={j}>
                        <span className="block h-5 animate-pulse rounded bg-sunken" />
                      </TD>
                    ))}
                  </TR>
                ))
              ) : (data?.rows.length ?? 0) === 0 ? (
                <TableEmpty colSpan={5} title={t("কোনো রেকর্ড পাওয়া যায়নি", "No audit records found")} />
              ) : (
                data!.rows.map((r) => (
                  <TR key={r.id}>
                    <TD className="text-[13px] text-text-secondary">{new Date(r.at).toLocaleString()}</TD>
                    <TD>{t(ENTITY_LABEL[r.entity]?.bn ?? r.entity, ENTITY_LABEL[r.entity]?.en ?? r.entity)}</TD>
                    <TD>
                      <Badge tone={ACTION_TONE[r.action] ?? "info"}>{r.action}</Badge>
                    </TD>
                    <TD className="text-[13px] text-text-secondary">{r.changedByName ?? t("সিস্টেম", "System")}</TD>
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

          {total > 0 ? (
            <Pagination
              label={t(
                `${(page - 1) * PER_PAGE + 1}–${Math.min(page * PER_PAGE, total)} দেখানো হচ্ছে · মোট ${total} জন`,
                `Showing ${(page - 1) * PER_PAGE + 1}-${Math.min(page * PER_PAGE, total)} of ${total}`,
              )}
              pages={pages}
              current={page}
              onPageChange={setPage}
            />
          ) : null}
        </>
      )}

      <Modal open={selected !== null} onClose={() => setSelected(null)} title={t("পরিবর্তনের বিস্তারিত", "Change details")}>
        {selected ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-[12px] font-semibold uppercase text-text-muted">{t("আগে", "Before")}</p>
              <pre className="max-h-64 overflow-auto rounded-lg bg-sunken p-3 text-[12px]">
                {JSON.stringify(selected.before, null, 2) ?? "—"}
              </pre>
            </div>
            <div>
              <p className="mb-1 text-[12px] font-semibold uppercase text-text-muted">{t("পরে", "After")}</p>
              <pre className="max-h-64 overflow-auto rounded-lg bg-sunken p-3 text-[12px]">
                {JSON.stringify(selected.after, null, 2) ?? "—"}
              </pre>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
