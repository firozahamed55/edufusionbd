"use client";

import { useState } from "react";
import { Download, History as HistoryIcon } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { Skeleton, EmptyState, ErrorState, PageHeader, Pagination } from "@/shared/ui";
import { exportCsv } from "@/shared/lib/exportCsv";
import { createClient } from "@/shared/services/supabase/client";
import { MAX_OPTIONS, PAGE_SIZE, pageCount } from "@/shared/services/supabase/paging";
import { fetchCampaigns } from "../../logic/api";
import { useCampaigns, useCampaignTotals } from "../../logic/hooks";

const typeLabel: Record<string, { bn: string; en: string }> = {
  parent: { bn: "অভিভাবক", en: "Parents" }, student: { bn: "শিক্ষার্থী", en: "Students" }, teacher: { bn: "শিক্ষক", en: "Teachers" },
};

export function HistoryScreen() {
  const { t, n, isBn } = useT();
  const [page, setPage] = useState(1);
  const q = useCampaigns(page);
  // Tiles read institution-wide totals from the DB. Summing `rows` would
  // describe only the visible page and look authoritative doing it.
  const totals = useCampaignTotals();
  const rows = q.data?.rows ?? [];
  const total = q.data?.total ?? 0;
  const pages = pageCount(total);

  // Export the whole history, not the page on screen — a CSV that silently
  // contains 25 of 400 campaigns is worse than no export button.
  async function exportAll() {
    const all = await fetchCampaigns(createClient(), 1, MAX_OPTIONS);
    exportCsv(
      `sms-history-${new Date().toISOString().slice(0, 10)}.csv`,
      all.rows.map((r) => ({
        Date: r.sent_at ?? "",
        RecipientType: r.recipient_type ?? "",
        RecipientGroup: r.recipient_group ?? "",
        Message: r.body ?? "",
        Count: r.recipient_count ?? 0,
        Cost: Math.round(r.est_cost ?? 0),
      })),
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start gap-3">
        <PageHeader
          crumbs={[{ label: t("SMS ও নোটিশ", "SMS & Notice"), href: "/admin/sms-notice/send" }, { label: t("ইতিহাস", "History") }]}
          title={t("SMS ইতিহাস", "SMS History")}
          subtitle={t("পাঠানো ক্যাম্পেইনসমূহের রেকর্ড", "Record of sent campaigns")}
          className="flex-1"
        />
        <button
          onClick={exportAll}
          disabled={total === 0}
          className="flex items-center gap-2 rounded-lg border border-border-strong bg-surface px-4 py-2.5 text-sm font-semibold text-text-secondary hover:bg-sunken disabled:opacity-60"
        >
          <Download size={16} /> {t("এক্সপোর্ট", "Export")}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-surface p-5 shadow-e1"><p className="text-meta text-text-muted">{t("মোট ক্যাম্পেইন", "Campaigns")}</p><p className="text-2xl font-bold text-text-primary tnum">{n(totals.data?.campaigns ?? total)}</p></div>
        <div className="rounded-2xl bg-surface p-5 shadow-e1"><p className="text-meta text-text-muted">{t("মোট প্রাপক", "Recipients")}</p><p className="text-2xl font-bold text-text-primary tnum">{n(totals.data?.recipients ?? 0)}</p></div>
        <div className="rounded-2xl bg-surface p-5 shadow-e1"><p className="text-meta text-text-muted">{t("আনুমানিক খরচ", "Est. cost")}</p><p className="text-2xl font-bold text-text-primary tnum">৳{n(Math.round(totals.data?.cost ?? 0))}</p></div>
      </div>

      {q.isLoading ? (
        <div className="flex flex-col gap-2 rounded-2xl bg-surface p-5 shadow-e1">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-11" />)}</div>
      ) : q.isError ? (
        <ErrorState title={t("ইতিহাস লোড করা যায়নি", "Could not load history")} />
      ) : total === 0 ? (
        <EmptyState icon={<HistoryIcon size={22} />} title={t("এখনও কোনো ক্যাম্পেইন নেই", "No campaigns yet")} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border-default bg-surface shadow-e1">
          <div className="min-w-180">
            <div className="flex items-center gap-3 border-b border-border-default px-5 py-3 text-meta font-semibold text-text-muted">
              <div className="w-40">{t("তারিখ", "Date")}</div>
              <div className="w-28">{t("প্রাপক", "Recipients")}</div>
              <div className="flex-1">{t("বার্তা", "Message")}</div>
              <div className="w-24 text-right">{t("সংখ্যা", "Count")}</div>
              <div className="w-24 text-right">{t("খরচ", "Cost")}</div>
            </div>
            {rows.map((r, i) => (
              <div key={r.id} className={cn("flex items-center gap-3 px-5 py-3", i % 2 === 1 && "bg-sunken")}>
                <div className="w-40 text-meta text-text-secondary tnum">{r.sent_at ? n(new Date(r.sent_at).toLocaleDateString(isBn ? "bn-BD" : "en-GB", { dateStyle: "medium" })) : "—"}</div>
                <div className="w-28 text-meta text-text-secondary">{r.recipient_type ? (isBn ? typeLabel[r.recipient_type]?.bn : typeLabel[r.recipient_type]?.en) ?? r.recipient_type : "—"}{r.recipient_group ? ` · ${r.recipient_group}` : ""}</div>
                <div className="min-w-0 flex-1 truncate text-meta text-text-primary">{r.body ?? "—"}</div>
                <div className="w-24 text-right text-meta font-semibold text-text-primary tnum">{n(r.recipient_count ?? 0)}</div>
                <div className="w-24 text-right text-meta text-text-secondary tnum">৳{n(Math.round(r.est_cost ?? 0))}</div>
              </div>
            ))}
          </div>
          <Pagination
            label={t(
              `${n((page - 1) * PAGE_SIZE + 1)}–${n((page - 1) * PAGE_SIZE + rows.length)} দেখানো হচ্ছে · মোট ${n(total)}`,
              `Showing ${n((page - 1) * PAGE_SIZE + 1)}–${n((page - 1) * PAGE_SIZE + rows.length)} of ${n(total)}`,
            )}
            pages={pages}
            current={page}
            perPage={PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
