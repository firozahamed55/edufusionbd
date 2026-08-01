"use client";

import { useEffect, useState } from "react";
import { Download, Search } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import {
  Field, Input, Button, Skeleton, ErrorState, PageHeader,
  Table, THead, TBody, TR, TH, TD, TableEmpty,
} from "@/shared/ui";
import { exportCsv } from "@/shared/lib/exportCsv";
import { useQueryState } from "@/shared/lib/useQueryState";
import { useIncomeStatement } from "../../logic/hooks";
import { useErrorMessage } from "@/shared/services/errors";
import { localDay, dayOffset } from "@/shared/lib/format";

/**
 * Fee · Income Statement — income and expenditure over a date range.
 *
 * The range lives in the URL (SRA A-0.1): a statement is the one artefact in
 * the finance module that gets *sent* to someone, and "last quarter" was
 * previously a set of controls the recipient had to be told how to reproduce.
 * The explicit Search button stays — A-0.3 kept exactly this pattern, because a
 * range is only meaningful once both ends are set.
 */
export function IncomeStatementScreen() {
  const { t, n } = useT();
  const msg = useErrorMessage();

  const [range, setRange] = useQueryState({ from: dayOffset(-30), to: localDay() });
  const [draft, setDraft] = useState(range);
  // The URL is the source of truth — a shared link must move the controls too.
  useEffect(() => setDraft(range), [range]);
  const { from, to } = draft;

  const q = useIncomeStatement(range.from, range.to, Boolean(range.from && range.to));
  const d = q.data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        crumbs={[{ label: t("ফি ও অর্থ", "Fees & Finance"), href: "/admin/fee/quick-collection-list" }, { label: t("আয় বিবরণী", "Income Statement") }]}
        title={t("আয় বিবরণী", "Income Statement")}
        subtitle={t("আয়-ব্যায়ের সমন্বিত বিবরণী", "Combined income & expenditure")}
      />

      <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-surface p-5 shadow-e1">
        <Field label={t("শুরুর তারিখ", "From")} required className="w-50">
          <Input type="date" value={from} max={to} onChange={(e) => setDraft((p) => ({ ...p, from: e.target.value }))} />
        </Field>
        <Field label={t("শেষ তারিখ", "To")} required className="w-50">
          <Input type="date" value={to} min={from} onChange={(e) => setDraft((p) => ({ ...p, to: e.target.value }))} />
        </Field>
        <Button variant="primary" className="h-10.5 px-6" onClick={() => setRange(draft)}><Search size={16} /> {t("অনুসন্ধান", "Search")}</Button>
        {d ? (
          <Button
            variant="secondary"
            className="h-10.5 px-6"
            onClick={() => exportCsv(
              `income-statement-${range.from}-to-${range.to}.csv`,
              [
                ...d.income.map((r) => ({ Section: "Income", Head: r.head, Debit: "", Credit: r.amount })),
                ...d.expense.map((r) => ({ Section: "Expenditure", Head: r.head, Debit: r.amount, Credit: "" })),
                { Section: "Net", Head: "Excess of income over expenditure", Debit: "", Credit: d.total_income - d.total_expense },
              ],
              { kind: "fee.income_statement", params: { from: range.from, to: range.to } },
            )}
          >
            <Download size={16} /> {t("এক্সপোর্ট", "Export")}
          </Button>
        ) : null}
      </div>

      {q.isLoading ? (
        <div className="flex flex-col gap-4">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}</div>
      ) : q.isError ? (
        <ErrorState title={t("বিবরণী লোড করা যায়নি", "Could not load statement")} description={msg(q.error)} />
      ) : d ? (
        <>
          <Ledger title={t("আয়ের তালিকা", "Income")} totalLabel={t("মোট আয়", "Total income")} credit={`৳${n(d.total_income)}`}>
            {d.income.length === 0
              ? <TableEmpty colSpan={3} title={t("কোনো তথ্য পাওয়া যায়নি", "No data found")} />
              : d.income.map((r) => <LedgerRow key={r.head} head={r.head} credit={`৳${n(r.amount)}`} />)}
          </Ledger>
          <Ledger title={t("ব্যায়ের তালিকা", "Expenditure")} totalLabel={t("মোট ব্যায়", "Total expense")} credit={`৳${n(d.total_expense)}`}>
            {d.expense.length === 0
              ? <TableEmpty colSpan={3} title={t("কোনো তথ্য পাওয়া যায়নি", "No data found")} />
              : d.expense.map((r) => <LedgerRow key={r.head} head={r.head} debit={`৳${n(r.amount)}`} />)}
          </Ledger>
          <Ledger title={t("লাভ / ক্ষতির তালিকা", "Profit / Loss")} totalLabel={t("সর্বমোট", "Net")} credit={`৳${n(d.total_income - d.total_expense)}`}>
            <LedgerRow head={t("আয়-ব্যায় উদ্বৃত্ত (Excess of Income over Expenditure)", "Excess of income over expenditure")} credit={`৳${n(d.total_income - d.total_expense)}`} />
          </Ledger>
        </>
      ) : null}
    </div>
  );
}

/**
 * A real `<table>` with a `<tfoot>` total (SRA A-0.7). A statement is the most
 * table-shaped object in the product — head, debit, credit — and it was three
 * nested flex `<div>`s per row, so a screen reader read the numbers with no way
 * to tell debit from credit, and the total was just another row of text.
 */
function Ledger({ title, totalLabel, credit, children }: { title: string; totalLabel: string; credit: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-base font-semibold text-text-primary">{title}</p>
      <Table minWidth={640}>
        <THead>
          <TR>
            <TH>{"খাত / Head"}</TH>
            <TH className="w-40 text-right">{"ডেবিট / Debit"}</TH>
            <TH className="w-40 text-right">{"ক্রেডিট / Credit"}</TH>
          </TR>
        </THead>
        <TBody>{children}</TBody>
        <tfoot>
          <tr className="bg-primary text-text-on-primary">
            <th scope="row" className="px-5 py-3.5 text-left text-sm font-semibold">{totalLabel}</th>
            <td className="px-5 py-3.5" />
            <td className="px-5 py-3.5 text-right text-sm font-bold tnum">{credit}</td>
          </tr>
        </tfoot>
      </Table>
    </div>
  );
}

function LedgerRow({ head, debit, credit }: { head: string; debit?: string; credit?: string }) {
  return (
    <TR>
      <TD className="text-meta text-text-secondary">{head}</TD>
      <TD className="text-right text-meta text-text-secondary tnum">{debit ?? "—"}</TD>
      <TD className="text-right text-meta font-semibold text-text-primary tnum">{credit ?? "—"}</TD>
    </TR>
  );
}
