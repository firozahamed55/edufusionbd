"use client";

import { Download, History as HistoryIcon } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { Skeleton, EmptyState, ErrorState, Breadcrumb } from "@/shared/ui";
import { exportCsv } from "@/shared/lib/exportCsv";
import { useCampaigns } from "../../logic/hooks";

const typeLabel: Record<string, { bn: string; en: string }> = {
  parent: { bn: "অভিভাবক", en: "Parents" }, student: { bn: "শিক্ষার্থী", en: "Students" }, teacher: { bn: "শিক্ষক", en: "Teachers" },
};

export function HistoryScreen() {
  const { t, n, isBn } = useT();
  const q = useCampaigns();
  const rows = q.data ?? [];
  const totalSent = rows.reduce((s, r) => s + (r.recipient_count ?? 0), 0);
  const totalCost = rows.reduce((s, r) => s + (r.est_cost ?? 0), 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start gap-3">
        <header className="flex-1">
          <Breadcrumb items={[{ label: t("SMS ও নোটিশ", "SMS & Notice"), href: "/admin/sms-notice/send" }, { label: t("ইতিহাস", "History") }]} />
          <h1 className="mt-1.5 text-h4 font-bold text-text-primary">{t("SMS ইতিহাস", "SMS History")}</h1>
          <p className="mt-1 text-meta text-text-muted">{t("পাঠানো ক্যাম্পেইনসমূহের রেকর্ড", "Record of sent campaigns")}</p>
        </header>
        <button
          onClick={() => exportCsv(
            `sms-history-${new Date().toISOString().slice(0, 10)}.csv`,
            rows.map((r) => ({
              Date: r.sent_at ?? "",
              RecipientType: r.recipient_type ?? "",
              RecipientGroup: r.recipient_group ?? "",
              Message: r.body ?? "",
              Count: r.recipient_count ?? 0,
              Cost: Math.round(r.est_cost ?? 0),
            })),
          )}
          disabled={rows.length === 0}
          className="flex items-center gap-2 rounded-lg border border-border-strong bg-surface px-4 py-2.5 text-sm font-semibold text-text-secondary hover:bg-sunken disabled:opacity-60"
        >
          <Download size={16} /> {t("এক্সপোর্ট", "Export")}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-surface p-5 shadow-e3"><p className="text-meta text-text-muted">{t("মোট ক্যাম্পেইন", "Campaigns")}</p><p className="text-2xl font-bold text-text-primary tnum">{n(rows.length)}</p></div>
        <div className="rounded-2xl bg-surface p-5 shadow-e3"><p className="text-meta text-text-muted">{t("মোট প্রাপক", "Recipients")}</p><p className="text-2xl font-bold text-text-primary tnum">{n(totalSent)}</p></div>
        <div className="rounded-2xl bg-surface p-5 shadow-e3"><p className="text-meta text-text-muted">{t("আনুমানিক খরচ", "Est. cost")}</p><p className="text-2xl font-bold text-text-primary tnum">৳{n(Math.round(totalCost))}</p></div>
      </div>

      {q.isLoading ? (
        <div className="flex flex-col gap-2 rounded-2xl bg-surface p-5 shadow-e3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-11" />)}</div>
      ) : q.isError ? (
        <ErrorState title={t("ইতিহাস লোড করা যায়নি", "Could not load history")} />
      ) : rows.length === 0 ? (
        <EmptyState icon={<HistoryIcon size={22} />} title={t("এখনও কোনো ক্যাম্পেইন নেই", "No campaigns yet")} />
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-surface shadow-e3">
          <div className="min-w-180">
            <div className="flex items-center gap-3 border-b border-border-default px-5 py-3 text-[12.5px] font-semibold text-text-muted">
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
        </div>
      )}
    </div>
  );
}
