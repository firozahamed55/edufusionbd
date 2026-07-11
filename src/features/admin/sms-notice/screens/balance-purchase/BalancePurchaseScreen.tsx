"use client";

import { Wallet, Check, Package } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import { Skeleton, EmptyState, Button, useToast } from "@/shared/ui";
import { useSmsAccount, usePackages, usePurchasePackage } from "../../logic/hooks";

export function BalancePurchaseScreen() {
  const { t, n } = useT();
  const toast = useToast();
  const account = useSmsAccount();
  const packages = usePackages();
  const purchase = usePurchasePackage();

  function buy(id: string) {
    purchase.mutate(id, {
      onSuccess: () => toast({ title: t("প্যাকেজ কেনা হয়েছে, ব্যালেন্স যুক্ত হয়েছে", "Package purchased, balance added"), variant: "success" }),
      onError: (e: unknown) => toast({ title: e instanceof Error ? e.message : t("ক্রয় ব্যর্থ", "Purchase failed"), variant: "error" }),
    });
  }

  return (
    <div className="flex flex-col gap-5 pb-6">
      <header>
        <div className="flex items-center gap-1.5 text-[13px] text-text-muted"><span>{t("SMS ও নোটিশ", "SMS & Notice")}</span><span>›</span><span className="text-text-secondary">{t("ব্যালেন্স", "Balance")}</span></div>
        <h1 className="mt-1.5 text-[22px] font-bold text-text-primary">{t("SMS ব্যালেন্স ও প্যাকেজ", "SMS Balance & Packages")}</h1>
        <p className="mt-1 text-[13px] text-text-muted">{t("বর্তমান ব্যালেন্স দেখুন ও প্যাকেজ কিনুন", "View balance and purchase packages")}</p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-4 rounded-2xl bg-linear-to-r from-[#4f46e5] to-[#7c3aed] p-6 text-white shadow-e3">
          <span className="grid size-12 place-items-center rounded-xl bg-white/20"><Wallet size={24} /></span>
          <div><p className="text-[13px] opacity-90">{t("বর্তমান ব্যালেন্স", "Current balance")}</p><p className="text-3xl font-bold tnum">{n(account.data?.balance ?? 0)}</p></div>
        </div>
        <div className="rounded-2xl bg-surface p-6 shadow-e3"><p className="text-[13px] text-text-muted">{t("প্রতি SMS রেট", "Per-SMS rate")}</p><p className="text-2xl font-bold text-text-primary tnum">৳{n(account.data?.per_sms_rate ?? 0)}</p></div>
        <div className="rounded-2xl bg-surface p-6 shadow-e3"><p className="text-[13px] text-text-muted">{t("সর্বশেষ রিচার্জ", "Last recharge")}</p><p className="text-2xl font-bold text-text-primary tnum">{account.data?.last_recharge_amount ? "৳" + n(account.data.last_recharge_amount) : "—"}</p></div>
      </div>

      <div className="flex flex-col gap-4">
        <p className="text-base font-semibold text-text-primary">{t("প্যাকেজসমূহ", "Packages")}</p>
        {packages.isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}</div>
        ) : (packages.data ?? []).length === 0 ? (
          <EmptyState icon={<Package size={22} />} title={t("কোনো প্যাকেজ নেই", "No packages available")} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(packages.data ?? []).map((p) => (
              <div key={p.id} className="flex flex-col gap-3 rounded-2xl bg-surface p-5 shadow-e3">
                <div className="flex items-center gap-2"><p className="flex-1 text-base font-semibold text-text-primary">{p.name}</p>{p.masking ? <span className="rounded-full bg-success-bg px-2 py-0.5 text-[11px] font-semibold text-success-fg">{t("মাস্কিং", "Masking")}</span> : null}</div>
                <p className="text-3xl font-bold text-primary tnum">{n(p.sms_qty)} <span className="text-sm font-medium text-text-muted">SMS</span></p>
                <div className="flex items-center gap-2 text-[13px] text-text-secondary"><Check size={14} className="text-success-fg" /> {t("রেট", "Rate")} ৳{n(p.rate)}/SMS</div>
                <div className="mt-auto flex items-center gap-3 pt-2">
                  <span className="flex-1 text-xl font-bold text-text-primary tnum">৳{n(p.price)}</span>
                  <Button variant="primary" onClick={() => buy(p.id)} disabled={purchase.isPending}>{purchase.isPending ? t("…", "…") : t("কিনুন", "Buy")}</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
