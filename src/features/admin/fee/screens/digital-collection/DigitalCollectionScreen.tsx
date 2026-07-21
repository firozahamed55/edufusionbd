"use client";

import { CreditCard } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { Skeleton, EmptyState, ErrorState, Breadcrumb } from "@/shared/ui";
import { useDigitalTransactions } from "../../logic/hooks";

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

export function DigitalCollectionScreen() {
  const { t, n, isBn } = useT();
  const q = useDigitalTransactions();
  const rows = q.data ?? [];
  const success = rows.filter((r) => r.status === "success");
  const pending = rows.filter((r) => r.status === "pending");
  const successTotal = success.reduce((s, r) => s + r.amount, 0);
  const rate = rows.length > 0 ? Math.round((success.length / rows.length) * 100) : 0;

  const KPIS = [
    { value: `৳${n(successTotal)}`, label: t("সফল আদায়", "Collected"), grad: "from-[#4f46e5] to-[#7c3aed]", shadow: "shadow-[0px_6px_16px_-4px_rgba(79,70,229,0.26)]" },
    { value: n(success.length), label: t("সফল লেনদেন", "Successful"), grad: "from-[#059669] to-[#0d9488]", shadow: "shadow-[0px_6px_16px_-4px_rgba(5,150,105,0.26)]" },
    { value: n(pending.length), label: t("অপেক্ষমাণ", "Pending"), grad: "from-[#0284c7] to-[#2563eb]", shadow: "shadow-[0px_6px_16px_-4px_rgba(2,132,199,0.26)]" },
    { value: `${n(rate)}%`, label: t("সফলতার হার", "Success rate"), grad: "from-[#f97316] to-[#d97706]", shadow: "shadow-[0px_6px_16px_-4px_rgba(249,115,22,0.26)]" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header>
        <Breadcrumb items={[{ label: t("ফি ও অর্থ", "Fees & Finance"), href: "/admin/fee/quick-collection-list" }, { label: t("ডিজিটাল ফি কালেকশন", "Digital Collection") }]} />
        <h1 className="mt-1.5 text-h4 font-bold text-text-primary">{t("ডিজিটাল ফি কালেকশন", "Digital Collection")}</h1>
        <p className="mt-1 text-meta text-text-muted">{t("অনলাইন পেমেন্ট সংগ্রহ ও লেনদেন", "Online payments & transactions")}</p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {q.isLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-[18px]" />) :
          KPIS.map((k) => (
            <div key={k.label} className={cn("flex flex-col gap-2 rounded-[18px] bg-linear-to-r px-5 py-4.5 text-white", k.grad, k.shadow)}>
              <p className="text-2xl font-bold tnum">{k.value}</p>
              <p className="text-meta font-medium opacity-90">{k.label}</p>
            </div>
          ))}
      </div>

      {q.isLoading ? (
        <div className="flex flex-col gap-2 rounded-2xl bg-surface p-5 shadow-e3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-11" />)}</div>
      ) : q.isError ? (
        <ErrorState title={t("লেনদেন লোড করা যায়নি", "Could not load transactions")} description={q.error instanceof Error ? q.error.message : undefined} />
      ) : rows.length === 0 ? (
        <EmptyState icon={<CreditCard size={22} />} title={t("কোনো ডিজিটাল লেনদেন নেই", "No digital transactions")} description={t("অনলাইন পেমেন্ট এলে এখানে দেখা যাবে।", "Online payments appear here.")} />
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-surface shadow-e3">
          <div className="min-w-230">
            <div className="flex items-center gap-3 border-b border-border-default px-5 py-4">
              <p className="flex-1 text-base font-semibold text-text-primary">{t("অনলাইন লেনদেন", "Online transactions")}</p>
              <span className="text-meta font-semibold text-primary">{t("মোট", "Total")}: {n(rows.length)}</span>
            </div>
            <div className="flex items-center gap-3 border-b border-border-default px-5 py-3 text-[12.5px] font-semibold text-text-muted">
              <div className="w-40">{t("তারিখ ও সময়", "Date & time")}</div>
              <div className="flex-1">{t("শিক্ষার্থী", "Student")}</div>
              <div className="w-22.5 text-right">{t("পরিমাণ", "Amount")}</div>
              <div className="w-22.5 text-center">{t("মাধ্যম", "Gateway")}</div>
              <div className="w-32.5">{t("ট্রানজেকশন আইডি", "Txn ID")}</div>
              <div className="w-27.5 text-center">{t("স্ট্যাটাস", "Status")}</div>
            </div>
            {rows.map((r, i) => {
              const g = gatewayMeta[r.gateway] ?? { bn: r.gateway, en: r.gateway, cls: "bg-sunken text-text-secondary" };
              const st = statusMeta[r.status] ?? { bn: r.status, en: r.status, cls: "bg-sunken text-text-secondary" };
              return (
                <div key={r.id} className={cn("flex items-center gap-3 px-5 py-3.5", i % 2 === 1 && "bg-sunken")}>
                  <div className="w-40 text-meta text-text-secondary tnum">{n(new Date(r.at).toLocaleString(isBn ? "bn-BD" : "en-GB", { dateStyle: "medium", timeStyle: "short" }))}</div>
                  <div className="flex-1 text-sm font-medium text-text-primary">{isBn ? r.name_bn : r.name_en}</div>
                  <div className="w-22.5 text-right text-meta font-semibold text-text-primary tnum">৳{n(r.amount)}</div>
                  <div className="w-22.5 text-center"><span className={cn("inline-block rounded-full px-2.5 py-1 text-xs font-semibold", g.cls)}>{isBn ? g.bn : g.en}</span></div>
                  <div className="w-32.5 font-latin text-meta text-text-secondary">{r.gateway_txn_id ?? "—"}</div>
                  <div className="w-27.5 text-center"><span className={cn("inline-block rounded-full px-2.5 py-1 text-xs font-semibold", st.cls)}>{isBn ? st.bn : st.en}</span></div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
