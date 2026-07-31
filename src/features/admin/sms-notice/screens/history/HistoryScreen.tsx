"use client";

import { useState } from "react";
import { History as HistoryIcon } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import {
  Skeleton, EmptyState, ErrorState, PageHeader, Pagination, LiveRegion,
  Table, THead, TBody, TR, TH, TD, TableEmpty, DataToolbar,
} from "@/shared/ui";
import { useDataScreen } from "@/shared/lib/useDataScreen";
import { exportCsv } from "@/shared/lib/exportCsv";
import { localDay, formatDate } from "@/shared/lib/format";
import { createClient } from "@/shared/services/supabase/client";
import { MAX_OPTIONS, PAGE_SIZE, pageCount } from "@/shared/services/supabase/paging";
import { fetchCampaigns } from "../../logic/api";
import { useCampaigns, useCampaignTotals } from "../../logic/hooks";

const typeLabel: Record<string, { bn: string; en: string }> = {
  parent: { bn: "অভিভাবক", en: "Parents" }, student: { bn: "শিক্ষার্থী", en: "Students" }, teacher: { bn: "শিক্ষক", en: "Teachers" },
};

/**
 * SMS · History. Campaign history only ever grows, so it pages on the SERVER —
 * `applyClientList` would be wrong here and "export all" would silently mean
 * "export page 1", which is the bug `fee/logic/api.ts` documents.
 */
export function HistoryScreen() {
  const { t, n, isBn } = useT();
  const ds = useDataScreen({ perPage: PAGE_SIZE });
  const page = ds.page;
  const [exportingAll, setExportingAll] = useState(false);
  const q = useCampaigns(page);
  // Tiles read institution-wide totals from the DB. Summing `rows` would
  // describe only the visible page and look authoritative doing it.
  const totals = useCampaignTotals();
  const rows = q.data?.rows ?? [];
  const total = q.data?.total ?? 0;

  // Export the whole history, not the page on screen — a CSV that silently
  // contains 25 of 400 campaigns is worse than no export button.
  async function exportAll() {
    setExportingAll(true);
    try {
      const all = await fetchCampaigns(createClient(), 1, MAX_OPTIONS);
      exportCsv(
        `sms-history-${localDay()}.csv`,
      all.rows.map((r) => ({
        Date: r.sent_at ?? "",
        RecipientType: r.recipient_type ?? "",
        RecipientGroup: r.recipient_group ?? "",
        Message: r.body ?? "",
        Count: r.recipient_count ?? 0,
        Cost: Math.round(r.est_cost ?? 0),
        })),
      );
    } finally {
      setExportingAll(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <LiveRegion message={q.isLoading ? t("লোড হচ্ছে", "Loading history") : t(`${n(total)} টি ক্যাম্পেইন`, `${total} campaigns`)} />

      <PageHeader
        crumbs={[{ label: t("SMS ও নোটিশ", "SMS & Notice"), href: "/admin/sms-notice/send" }, { label: t("ইতিহাস", "History") }]}
        title={t("SMS ইতিহাস", "SMS History")}
        subtitle={t("পাঠানো ক্যাম্পেইনসমূহের রেকর্ড", "Record of sent campaigns")}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-surface p-5 shadow-e1"><p className="text-meta text-text-muted">{t("মোট ক্যাম্পেইন", "Campaigns")}</p><p className="text-2xl font-bold text-text-primary tnum">{n(totals.data?.campaigns ?? total)}</p></div>
        <div className="rounded-2xl bg-surface p-5 shadow-e1"><p className="text-meta text-text-muted">{t("মোট প্রাপক", "Recipients")}</p><p className="text-2xl font-bold text-text-primary tnum">{n(totals.data?.recipients ?? 0)}</p></div>
        <div className="rounded-2xl bg-surface p-5 shadow-e1"><p className="text-meta text-text-muted">{t("আনুমানিক খরচ", "Est. cost")}</p><p className="text-2xl font-bold text-text-primary tnum">৳{n(Math.round(totals.data?.cost ?? 0))}</p></div>
      </div>

      <DataToolbar onExportAll={exportAll} exportAllCount={total} exportingAll={exportingAll} />

      {q.isError ? (
        <ErrorState title={t("ইতিহাস লোড করা যায়নি", "Could not load history")} />
      ) : !q.isLoading && total === 0 ? (
        <EmptyState icon={<HistoryIcon size={22} />} title={t("এখনও কোনো ক্যাম্পেইন নেই", "No campaigns yet")} />
      ) : (
        <>
          <Table minWidth={720}>
            <THead>
              <TR>
                <TH className="w-40">{t("তারিখ", "Date")}</TH>
                <TH className="w-32">{t("প্রাপক", "Recipients")}</TH>
                <TH>{t("বার্তা", "Message")}</TH>
                <TH className="w-24 text-right">{t("সংখ্যা", "Count")}</TH>
                <TH className="w-24 text-right">{t("খরচ", "Cost")}</TH>
              </TR>
            </THead>
            <TBody>
              {q.isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TR key={i}>{Array.from({ length: 5 }).map((__, j) => <TD key={j}><Skeleton className="h-5" /></TD>)}</TR>
                ))
              ) : rows.length === 0 ? (
                <TableEmpty colSpan={5} title={t("কোনো ক্যাম্পেইন নেই", "No campaigns")} />
              ) : (
                rows.map((r) => (
                  <TR key={r.id}>
                    <TD className="text-meta text-text-secondary tnum">{r.sent_at ? n(formatDate(r.sent_at)) : "—"}</TD>
                    <TD className="text-meta text-text-secondary">{r.recipient_type ? (isBn ? typeLabel[r.recipient_type]?.bn : typeLabel[r.recipient_type]?.en) ?? r.recipient_type : "—"}{r.recipient_group ? ` · ${r.recipient_group}` : ""}</TD>
                    <TD className="max-w-0 truncate text-meta text-text-primary">{r.body ?? "—"}</TD>
                    <TD className="text-right text-meta font-semibold text-text-primary tnum">{n(r.recipient_count ?? 0)}</TD>
                    <TD className="text-right text-meta text-text-secondary tnum">৳{n(Math.round(r.est_cost ?? 0))}</TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>

          {total > 0 ? (
            <Pagination
              label={t(
                `${n(ds.from)}–${n(ds.to(total))} দেখানো হচ্ছে · মোট ${n(total)}`,
                `Showing ${ds.from}-${ds.to(total)} of ${total}`,
              )}
              pages={pageCount(total)}
              current={page}
              perPage={PAGE_SIZE}
              onPageChange={ds.setPage}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
