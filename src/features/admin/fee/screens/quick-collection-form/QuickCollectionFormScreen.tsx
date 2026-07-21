"use client";

import { useEffect, useState } from "react";
import { Search, User, Receipt } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { PAYMENT_METHOD } from "@/shared/constants/enums";
import { createClient } from "@/shared/services/supabase/client";
import { Field, Input, Select, Button, Skeleton, EmptyState, ErrorState, useToast, Breadcrumb } from "@/shared/ui";
import { useStudentProfile, useStudentInvoices, useCollectFee, useAccounts } from "../../logic/hooks";
import { findStudentIdByCode } from "../../logic/api";

/** Fee · Quick Collection (form) — look up a student, collect against their invoices. */
export function QuickCollectionFormScreen() {
  const { t, n, isBn } = useT();
  const toast = useToast();
  const [code, setCode] = useState("");
  const [studentId, setStudentId] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [method, setMethod] = useState("cash");
  const [accountId, setAccountId] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const profile = useStudentProfile(studentId);
  const invoices = useStudentInvoices(studentId);
  const accounts = useAccounts();
  const collect = useCollectFee();

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search).get("student");
    if (sp) setStudentId(sp);
  }, []);

  async function search() {
    if (!code.trim()) return;
    setSearching(true);
    try {
      const id = await findStudentIdByCode(createClient(), code.trim());
      if (!id) { toast({ title: t("শিক্ষার্থী পাওয়া যায়নি", "Student not found"), variant: "error" }); return; }
      setStudentId(id);
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : t("অনুসন্ধান ব্যর্থ", "Search failed"), variant: "error" });
    } finally { setSearching(false); }
  }

  function collectOne(invoiceId: string, due: number) {
    const raw = amounts[invoiceId];
    const amt = raw && raw.trim() ? raw : String(due);
    collect.mutate({ fee_invoice_id: invoiceId, amount: amt, method, account_id: accountId || undefined }, {
      onSuccess: () => { toast({ title: t("ফি আদায় সম্পন্ন হয়েছে", "Fee collected"), variant: "success" }); setAmounts((p) => ({ ...p, [invoiceId]: "" })); },
      onError: (e: unknown) => toast({ title: e instanceof Error ? e.message : t("আদায় ব্যর্থ", "Collection failed"), variant: "error" }),
    });
  }

  const rows = invoices.data ?? [];
  const totalDue = rows.reduce((s, r) => s + r.due, 0);
  const totalPaid = rows.reduce((s, r) => s + r.paid, 0);

  return (
    <div className="flex flex-col gap-6 pb-6">
      <header>
        <Breadcrumb items={[{ label: t("ফি ও অর্থ", "Fees & Finance"), href: "/admin/fee/quick-collection-list" }, { label: t("দ্রুত ফি আদায়", "Fast fee collection") }]} />
        <h1 className="mt-1.5 text-h4 font-bold text-text-primary">{t("কুইক কালেকশন", "Quick Collection")}</h1>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        <div className="flex flex-col gap-3 rounded-2xl bg-surface p-5 shadow-e3">
          <Field label={t("শিক্ষার্থী আইডি", "Student ID")} required>
            <Input value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} placeholder="STU-0001" className="font-latin" />
          </Field>
          <Button variant="primary" onClick={search} disabled={searching}><Search size={15} /> {searching ? t("খুঁজছে…", "Searching…") : t("অনুসন্ধান", "Search")}</Button>
        </div>

        <div className="flex flex-col gap-2.5 rounded-2xl bg-surface p-5 shadow-e3">
          {!studentId ? (
            <div className="flex flex-1 items-center justify-center gap-2 text-meta text-text-muted"><User size={18} /> {t("একজন শিক্ষার্থী খুঁজুন", "Look up a student")}</div>
          ) : profile.isLoading ? (
            <div className="flex flex-col gap-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-6" />)}</div>
          ) : profile.data ? (
            <>
              <ProfileRow label={t("নাম", "Name")} value={isBn ? profile.data.name_bn : profile.data.name_en} strong />
              <div className="grid grid-cols-2 gap-2">
                <ProfileRow label={t("আইডি", "ID")} value={profile.data.code ? n(profile.data.code) : "—"} />
                <ProfileRow label={t("রোল", "Roll")} value={profile.data.roll != null ? n(profile.data.roll) : "—"} />
              </div>
              <ProfileRow label={t("শাখা", "Section")} value={profile.data.section} />
              <ProfileRow label={t("পিতা", "Father")} value={profile.data.father ?? "—"} />
              <ProfileRow label={t("মোবাইল", "Mobile")} value={profile.data.mobile ? n(profile.data.mobile) : "—"} />
            </>
          ) : (
            <EmptyState title={t("শিক্ষার্থী পাওয়া যায়নি", "Student not found")} />
          )}
        </div>
      </div>

      {studentId ? (
        <>
          <div className="grid grid-cols-1 gap-4 rounded-2xl bg-surface p-5 shadow-e3 sm:grid-cols-2">
            <Field label={t("পেমেন্ট মাধ্যম", "Payment method")} required>
              <Select value={method} onChange={(e) => setMethod(e.target.value)} options={PAYMENT_METHOD.map((m) => ({ value: m.value, label: isBn ? m.bn : m.en }))} />
            </Field>
            <Field label={t("অ্যাকাউন্ট", "Account")}>
              <Select value={accountId} placeholder={t("নির্বাচন (ঐচ্ছিক)", "Select (optional)")} options={(accounts.data ?? []).map((a) => ({ value: a.id, label: a.name }))} onChange={(e) => setAccountId(e.target.value)} />
            </Field>
          </div>

          <div className="overflow-x-auto rounded-2xl bg-surface shadow-e3">
            <div className="min-w-200">
              <div className="flex items-center gap-3 border-b border-border-default px-5 py-3 text-[12.5px] font-semibold text-text-muted">
                <div className="w-40">{t("ফি হেড", "Fee heads")}</div>
                <div className="flex-1">{t("সময়কাল", "Period")}</div>
                <div className="w-25 text-right">{t("মোট", "Total")}</div>
                <div className="w-25 text-right">{t("বকেয়া", "Due")}</div>
                <div className="w-32 text-right">{t("আদায় পরিমাণ", "Collect")}</div>
                <div className="w-24 text-right">{t("অ্যাকশন", "Action")}</div>
              </div>
              {invoices.isLoading ? (
                <div className="flex flex-col gap-2 p-5">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
              ) : invoices.isError ? (
                <div className="p-5"><ErrorState title={t("ইনভয়েস লোড করা যায়নি", "Could not load invoices")} /></div>
              ) : rows.length === 0 ? (
                <div className="p-5"><EmptyState icon={<Receipt size={22} />} title={t("কোনো ইনভয়েস নেই", "No invoices")} /></div>
              ) : (
                rows.map((r, i) => (
                  <div key={r.id} className={cn("flex items-center gap-3 px-5 py-3.5 border-b border-border-default last:border-0", i % 2 === 1 && "bg-sunken")}>
                    <div className="w-40 text-sm font-semibold text-text-primary">{r.heads || "—"}</div>
                    <div className="flex-1 text-meta text-text-secondary">{r.period ?? "—"}</div>
                    <div className="w-25 text-right text-meta text-text-secondary tnum">৳{n(r.total)}</div>
                    <div className="w-25 text-right text-meta font-semibold text-danger-fg tnum">৳{n(r.due)}</div>
                    <div className="w-32">
                      <Input type="number" min={0} value={amounts[r.id] ?? ""} onChange={(e) => setAmounts((p) => ({ ...p, [r.id]: e.target.value }))} placeholder={String(r.due)} disabled={r.due <= 0} className="h-9 text-right font-latin" />
                    </div>
                    <div className="flex w-24 justify-end">
                      <Button variant="primary" className="h-9 px-3" onClick={() => collectOne(r.id, r.due)} disabled={r.due <= 0 || collect.isPending}>{t("আদায়", "Collect")}</Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SummaryTile gradient="from-emerald-500 to-teal-600" label={t("মোট পরিশোধিত", "Total paid")} value={`৳${n(totalPaid)}`} />
            <SummaryTile gradient="from-sky-500 to-blue-600" label={t("সর্বমোট বকেয়া", "Total due")} value={`৳${n(totalDue)}`} />
          </div>
        </>
      ) : null}
    </div>
  );
}

function ProfileRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center gap-3 text-meta">
      <span className="w-20 shrink-0 text-text-muted">{label}</span>
      <span className={cn("flex-1 truncate", strong ? "font-semibold text-text-primary" : "text-text-secondary")}>{value}</span>
    </div>
  );
}
function SummaryTile({ gradient, label, value }: { gradient: string; label: string; value: string }) {
  return (
    <div className={cn("flex flex-col gap-2 rounded-2xl bg-linear-to-r p-5 text-center text-white shadow-e3", gradient)}>
      <p className="text-meta font-medium opacity-90">{label}</p>
      <p className="text-2xl font-bold tnum">{value}</p>
    </div>
  );
}
