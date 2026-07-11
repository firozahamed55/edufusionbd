"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { Field, Input, Button, Skeleton, ErrorState } from "@/shared/ui";
import { useIncomeStatement } from "../../logic/hooks";

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Fee · Income Statement — live income/expenditure over a date range. */
export function IncomeStatementScreen() {
  const { t, n } = useT();
  const today = new Date();
  const monthAgo = new Date(today.getTime() - 30 * 864e5);
  const [from, setFrom] = useState(iso(monthAgo));
  const [to, setTo] = useState(iso(today));
  const [range, setRange] = useState<{ from: string; to: string }>({ from: iso(monthAgo), to: iso(today) });

  const q = useIncomeStatement(range.from, range.to, Boolean(range.from && range.to));
  const d = q.data;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-[22px] font-bold text-text-primary">{t("আয় বিবরণী", "Income Statement")}</h1>
        <p className="mt-1 flex items-center gap-1.5 text-[13px] text-text-muted">{t("ফি ও অর্থ", "Fees & Finance")} <span>•</span> {t("আয়-ব্যায়ের সমন্বিত বিবরণী", "Combined income & expenditure")}</p>
      </header>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-surface p-5 shadow-e3">
        <Field label={t("শুরুর তারিখ", "From")} required className="w-50"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label={t("শেষ তারিখ", "To")} required className="w-50"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <Button variant="primary" className="h-10.5 px-6" onClick={() => setRange({ from, to })}><Search size={16} /> {t("অনুসন্ধান", "Search")}</Button>
      </div>

      {q.isLoading ? (
        <div className="flex flex-col gap-4">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}</div>
      ) : q.isError ? (
        <ErrorState title={t("বিবরণী লোড করা যায়নি", "Could not load statement")} description={q.error instanceof Error ? q.error.message : undefined} />
      ) : d ? (
        <>
          <Ledger title={t("আয়ের তালিকা", "Income")} totalLabel={t("মোট আয়", "Total income")} credit={`৳${n(d.total_income)}`}>
            {d.income.length === 0 ? <Empty t={t} /> : d.income.map((r, i) => <LedgerRow key={r.head} head={r.head} credit={`৳${n(r.amount)}`} last={i === d.income.length - 1} />)}
          </Ledger>
          <Ledger title={t("ব্যায়ের তালিকা", "Expenditure")} totalLabel={t("মোট ব্যায়", "Total expense")} credit={`৳${n(d.total_expense)}`}>
            {d.expense.length === 0 ? <Empty t={t} /> : d.expense.map((r, i) => <LedgerRow key={r.head} head={r.head} debit={`৳${n(r.amount)}`} last={i === d.expense.length - 1} />)}
          </Ledger>
          <Ledger title={t("লাভ / ক্ষতির তালিকা", "Profit / Loss")} totalLabel={t("সর্বমোট", "Net")} credit={`৳${n(d.total_income - d.total_expense)}`}>
            <LedgerRow head={t("আয়-ব্যায় উদ্বৃত্ত (Excess of Income over Expenditure)", "Excess of income over expenditure")} credit={`৳${n(d.total_income - d.total_expense)}`} last />
          </Ledger>
        </>
      ) : null}
    </div>
  );
}

function Empty({ t }: { t: (bn: string, en: string) => string }) {
  return <div className="px-5 py-6 text-center text-[13px] text-text-muted">{t("কোনো তথ্য পাওয়া যায়নি", "No data found")}</div>;
}

function Ledger({ title, totalLabel, credit, children }: { title: string; totalLabel: string; credit: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-surface shadow-e3">
      <div className="border-b border-border-default px-5 py-4"><p className="text-base font-semibold text-text-primary">{title}</p></div>
      <div className="flex items-center gap-3 border-b border-border-default px-5 py-3 text-[12.5px] font-semibold text-text-muted">
        <div className="flex-1">{title.includes("আয়") || title.toLowerCase().includes("income") ? "খাত / Head" : "খাত / Head"}</div>
        <div className="w-40 text-right">{"ডেবিট / Debit"}</div>
        <div className="w-40 text-right">{"ক্রেডিট / Credit"}</div>
      </div>
      {children}
      <div className="flex items-center gap-3 bg-primary px-5 py-3.5 text-text-on-primary">
        <div className="flex-1 text-sm font-semibold">{totalLabel}</div>
        <div className="w-40 text-right text-sm font-bold" />
        <div className="w-40 text-right text-sm font-bold tnum">{credit}</div>
      </div>
    </div>
  );
}

function LedgerRow({ head, debit, credit, last }: { head: string; debit?: string; credit?: string; last?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3 px-5 py-3.5", !last && "border-b border-border-default")}>
      <div className="flex-1 text-[13px] text-text-secondary">{head}</div>
      <div className="w-40 text-right text-[13px] text-text-secondary tnum">{debit ?? "—"}</div>
      <div className="w-40 text-right text-[13px] font-semibold text-text-primary tnum">{credit ?? "—"}</div>
    </div>
  );
}
