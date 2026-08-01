"use client";

import { CreditCard } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import {
  Skeleton, EmptyState, ErrorState, PageHeader, Pagination, LiveRegion,
  Table, THead, TBody, TR, TH, TD, TableEmpty, DataToolbar,
} from "@/shared/ui";
import { useDataScreen } from "@/shared/lib/useDataScreen";
import { exportCsv } from "@/shared/lib/exportCsv";
import { localDay, formatDateTime } from "@/shared/lib/format";
import { useDigitalTransactions, useDigitalTransactionStats } from "../../logic/hooks";
import { useErrorMessage } from "@/shared/services/errors";

/** Fee · Digital Collection — live online-payment transactions + computed KPIs. */
const statusMeta: Record<string, { bn: string; en: string; cls: string }> = {
  success: { bn: "সফল", en: "Success", cls: "bg-success-bg text-success-fg" },
  pending: { bn: "অপেক্ষমাণ", en: "Pending", cls: "bg-warning-bg text-warning-fg" },
  failed: { bn: "ব্যর্থ", en: "Failed", cls: "bg-danger-bg text-danger-fg" },
};
const gatewayMeta: Record<string, { bn: string; en: string; cls: string }> = {
  bkash: { bn: "বিকাশ", en: "bKash", cls: "bg-danger-bg text-danger-fg" },
  nagad: { bn: "নগদ", en: "Nagad", cls: "bg-warning-bg text-warning-fg" },
  card: { bn: "কার্ড", en: "Card", cls: "bg-primary-subtle text-primary" },
  rocket: { bn: "রকেট", en: "Rocket", cls: "bg-info-bg text-info-fg" },
};

const PER_PAGE = 25;

export function DigitalCollectionScreen() {
  const { t, n, isBn } = useT();
  const msg = useErrorMessage();
  // Transactions only ever grow — server-paged, so "export" is honest about
  // being this page (a whole-history export needs a bounded second fetch, and
  // there is no reconciliation view to hang it off yet).
  const ds = useDataScreen({ perPage: PER_PAGE });
  const page = ds.page;
  const q = useDigitalTransactions(page);
  const stats = useDigitalTransactionStats();
  const rows = q.data?.rows ?? [];
  const total = q.data?.total ?? 0;
  const s = stats.data;
  const rate = s && s.total > 0 ? Math.round((s.successCount / s.total) * 100) : 0;

  const KPIS = [
    { value: `৳${n(s?.successTotal ?? 0)}`, label: t("সফল আদায়", "Collected"), grad: "grad-indigo", shadow: "shadow-e2" },
    { value: n(s?.successCount ?? 0), label: t("সফল লেনদেন", "Successful"), grad: "grad-emerald", shadow: "shadow-e2" },
    { value: n(s?.pendingCount ?? 0), label: t("অপেক্ষমাণ", "Pending"), grad: "grad-sky", shadow: "shadow-e2" },
    { value: `${n(rate)}%`, label: t("সফলতার হার", "Success rate"), grad: "grad-amber", shadow: "shadow-e2" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <LiveRegion message={q.isLoading ? t("লোড হচ্ছে", "Loading transactions") : t(`${n(total)} টি লেনদেন`, `${total} transactions`)} />

      <PageHeader
        crumbs={[{ label: t("ফি ও অর্থ", "Fees & Finance"), href: "/admin/fee/quick-collection-list" }, { label: t("ডিজিটাল ফি কালেকশন", "Digital Collection") }]}
        title={t("ডিজিটাল ফি কালেকশন", "Digital Collection")}
        subtitle={t("অনলাইন পেমেন্ট সংগ্রহ ও লেনদেন", "Online payments & transactions")}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {q.isLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />) :
          KPIS.map((k) => (
            <div key={k.label} className={cn("flex flex-col gap-2 rounded-2xl px-5 py-4.5 text-white", k.grad, k.shadow)}>
              <p className="text-2xl font-bold tnum">{k.value}</p>
              <p className="text-meta font-medium opacity-90">{k.label}</p>
            </div>
          ))}
      </div>

      <DataToolbar
        onExportPage={() =>
          exportCsv(
            `digital-transactions-page${page}-${localDay()}.csv`,
            rows.map((r) => ({
              DateTime: r.at,
              Student: r.name_en,
              Amount: r.amount,
              Gateway: r.gateway,
              TxnId: r.gateway_txn_id ?? "",
              Status: r.status,
            })),
            { kind: "fee.digital_collection", params: { page, scope: "page" } },
          )
        }
        exportPageCount={rows.length}
      />

      {q.isError ? (
        <ErrorState title={t("লেনদেন লোড করা যায়নি", "Could not load transactions")} description={msg(q.error)} />
      ) : !q.isLoading && total === 0 ? (
        <EmptyState icon={<CreditCard size={22} />} title={t("কোনো ডিজিটাল লেনদেন নেই", "No digital transactions")} description={t("অনলাইন পেমেন্ট এলে এখানে দেখা যাবে।", "Online payments appear here.")} />
      ) : (
        <>
          <Table minWidth={920}>
            <THead>
              <TR>
                <TH className="w-44">{t("তারিখ ও সময়", "Date & time")}</TH>
                <TH>{t("শিক্ষার্থী", "Student")}</TH>
                <TH className="w-24 text-right">{t("পরিমাণ", "Amount")}</TH>
                <TH className="w-24 text-center">{t("মাধ্যম", "Gateway")}</TH>
                <TH className="w-36">{t("ট্রানজেকশন আইডি", "Txn ID")}</TH>
                <TH className="w-28 text-center">{t("স্ট্যাটাস", "Status")}</TH>
              </TR>
            </THead>
            <TBody>
              {q.isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TR key={i}>{Array.from({ length: 6 }).map((__, j) => <TD key={j}><Skeleton className="h-5" /></TD>)}</TR>
                ))
              ) : rows.length === 0 ? (
                <TableEmpty colSpan={6} title={t("কোনো লেনদেন নেই", "No transactions")} />
              ) : (
                rows.map((r) => {
                  const g = gatewayMeta[r.gateway] ?? { bn: r.gateway, en: r.gateway, cls: "bg-sunken text-text-secondary" };
                  const st = statusMeta[r.status] ?? { bn: r.status, en: r.status, cls: "bg-sunken text-text-secondary" };
                  return (
                    <TR key={r.id}>
                      <TD className="text-meta text-text-secondary tnum">{n(formatDateTime(r.at))}</TD>
                      <TD className="text-sm font-medium text-text-primary">{isBn ? r.name_bn : r.name_en}</TD>
                      <TD className="text-right text-meta font-semibold text-text-primary tnum">৳{n(r.amount)}</TD>
                      <TD className="text-center"><span className={cn("inline-block rounded-full px-2.5 py-1 text-xs font-semibold", g.cls)}>{isBn ? g.bn : g.en}</span></TD>
                      <TD className="font-latin text-meta text-text-secondary">{r.gateway_txn_id ?? "—"}</TD>
                      <TD className="text-center"><span className={cn("inline-block rounded-full px-2.5 py-1 text-xs font-semibold", st.cls)}>{isBn ? st.bn : st.en}</span></TD>
                    </TR>
                  );
                })
              )}
            </TBody>
          </Table>

          {total > 0 ? (
            <Pagination
              label={t(
                `${n(ds.from)}–${n(ds.to(total))} দেখানো হচ্ছে · মোট ${n(total)}`,
                `Showing ${ds.from}-${ds.to(total)} of ${total}`,
              )}
              pages={ds.pages(total)}
              current={page}
              onPageChange={ds.setPage}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
