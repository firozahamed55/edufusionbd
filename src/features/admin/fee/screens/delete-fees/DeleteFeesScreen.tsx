"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Trash2, Receipt } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import {
  Checkbox, Skeleton, EmptyState, ErrorState, DangerConfirm, useToast, PageHeader, Pagination,
  LiveRegion, DataToolbar, BulkBar, BulkAction, Badge,
  Table, THead, TBody, TR, TH, TD, TableEmpty, SortableTH,
} from "@/shared/ui";
import { useDataScreen } from "@/shared/lib/useDataScreen";
import { exportCsv } from "@/shared/lib/exportCsv";
import { localDay } from "@/shared/lib/format";
import { useAppliedFees, useDeleteFeeInvoices } from "../../logic/hooks";
import { APPLIED_FEE_PAGE_SIZE } from "../../logic/api";
import { useErrorMessage } from "@/shared/services/errors";

/**
 * Fee · Delete Fees — void mistakenly applied invoices.
 *
 * This screen exists to find ONE wrong invoice among thousands, and until now
 * the only way through them was the page buttons (SRA A-0.1). Search, status
 * filter, sort and page are server-side and URL-backed: `fee_invoice` grows as
 * students × heads × periods, so client filtering would search the visible 25
 * and call the rest absent.
 *
 * Selection deliberately survives a page change — `fn_delete_fee_invoice` takes
 * a list and an operator may be voiding a run that spans pages. "Select all"
 * therefore means every row on THIS page, and the selected-total below sums
 * only the visible ones; the count is the authoritative number.
 */
export function DeleteFeesScreen() {
  const { t, n, isBn } = useT();
  const msg = useErrorMessage();
  const toast = useToast();

  const ds = useDataScreen({ filters: { status: "" }, perPage: APPLIED_FEE_PAGE_SIZE });
  const q = useAppliedFees({
    page: ds.page,
    q: ds.debouncedQ,
    status: ds.filters.status,
    sort: ds.sort as { key: string; dir: "asc" | "desc" } | null,
  });
  const del = useDeleteFeeInvoices();
  const [confirm, setConfirm] = useState(false);

  const rows = useMemo(() => q.data?.rows ?? [], [q.data]);
  const total = q.data?.total ?? 0;
  const sel = ds.useSelection(rows.map((r) => r.id));
  const selectedTotal = useMemo(
    () => rows.filter((r) => sel.has(r.id)).reduce((s, r) => s + r.due, 0),
    [rows, sel],
  );

  function doDelete() {
    setConfirm(false);
    del.mutate(sel.asArray(), {
      onSuccess: (count) => {
        toast({ title: t(`${n(count)} টি ফি মুছে ফেলা হয়েছে`, `${count} fees deleted`), variant: "success" });
        sel.clear();
      },
      onError: (e: unknown) => toast({ title: msg(e, { bn: "মুছে ফেলা ব্যর্থ", en: "Delete failed" }), variant: "error" }),
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <LiveRegion
        message={
          q.isLoading
            ? t("লোড হচ্ছে", "Loading invoices")
            : t(`${n(total)} টি আরোপিত ফি পাওয়া গেছে`, `${total} applied fees`)
        }
      />

      <PageHeader
        crumbs={[{ label: t("ফি ও অর্থ", "Fees & Finance"), href: "/admin/fee/quick-collection-list" }, { label: t("ফি মুছুন", "Delete Fees") }]}
        title={t("ফি মুছুন", "Delete Fees")}
        subtitle={t("ভুলবশত আরোপিত ফি অপসারণ", "Remove mistakenly applied fees")}
      />

      <div className="flex items-start gap-3 rounded-xl border border-danger-fg/40 bg-danger-bg p-4 text-danger-fg">
        <AlertTriangle size={20} className="mt-0.5 shrink-0" />
        <p className="text-meta font-medium leading-relaxed">
          {t("সতর্কতা: মুছে ফেলা ফি অকার্যকর (void) হবে এবং তালিকা থেকে সরিয়ে ফেলা হবে।", "Warning: deleted fees are voided and removed from the list.")}
        </p>
      </div>

      <DataToolbar
        q={ds.q}
        onQChange={ds.setQ}
        placeholder={t("নাম বা শিক্ষার্থী আইডি", "Name or student ID")}
        searchLabel={t("আরোপিত ফি খুঁজুন", "Search applied fees")}
        isFiltered={ds.isFiltered}
        onReset={ds.reset}
        filters={
          <select
            value={ds.filters.status}
            onChange={(e) => ds.setFilter("status", e.target.value)}
            aria-label={t("স্ট্যাটাস ফিল্টার", "Filter by status")}
            className="rounded-lg border border-border-strong bg-surface px-3 py-2.5 text-meta font-medium text-text-secondary"
          >
            <option value="">{t("সব স্ট্যাটাস", "All statuses")}</option>
            <option value="unpaid">{t("অপরিশোধিত", "Unpaid")}</option>
            <option value="partial">{t("আংশিক", "Partial")}</option>
            <option value="paid">{t("পরিশোধিত", "Paid")}</option>
          </select>
        }
        // This page only: the invoice table is unbounded, so an "export all"
        // here would quietly hand the office a one-page spreadsheet.
        onExportPage={() =>
          exportCsv(
            `applied-fees-${localDay()}.csv`,
            rows.map((r) => ({
              StudentId: r.code ?? "",
              Name: r.name_en,
              FeeHeads: r.heads,
              Period: r.period ?? "",
              Due: r.due,
              Status: r.status,
            })),
            { kind: "fee.applied_fees", params: { q: ds.debouncedQ, status: ds.filters.status, page: ds.page, scope: "page" } },
          )
        }
        exportPageCount={rows.length}
      />

      <BulkBar count={sel.count} onClear={sel.clear}>
        <BulkAction onClick={() => setConfirm(true)} icon={<Trash2 size={14} />}>
          {del.isPending ? t("মুছছে…", "Deleting…") : t("নির্বাচিত মুছুন", "Delete selected")}
        </BulkAction>
      </BulkBar>

      {q.isError ? (
        <ErrorState title={t("তালিকা লোড করা যায়নি", "Could not load list")} description={msg(q.error)} />
      ) : !q.isLoading && total === 0 && !ds.isFiltered ? (
        <EmptyState icon={<Receipt size={22} />} title={t("কোনো আরোপিত ফি নেই", "No applied fees")} />
      ) : (
        <>
          <Table minWidth={900}>
            <THead>
              <TR>
                <TH className="w-12">
                  <Checkbox
                    checked={sel.allOnPage}
                    indeterminate={sel.someOnPage}
                    onChange={sel.toggleAll}
                    aria-label={t("এই পাতার সব নির্বাচন", "Select all on this page")}
                  />
                </TH>
                <TH>{t("শিক্ষার্থী", "Student")}</TH>
                <TH>{t("আইডি", "ID")}</TH>
                <TH>{t("ফি হেড", "Fee heads")}</TH>
                <SortableTH sortKey="period" sort={ds.sort} onSort={ds.setSort}>{t("সময়কাল", "Period")}</SortableTH>
                <SortableTH sortKey="due" sort={ds.sort} onSort={ds.setSort} className="text-right">{t("বকেয়া", "Due")}</SortableTH>
                <TH className="text-center">{t("স্ট্যাটাস", "Status")}</TH>
              </TR>
            </THead>
            <TBody>
              {q.isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TR key={i}>{Array.from({ length: 7 }).map((__, j) => <TD key={j}><Skeleton className="h-5" /></TD>)}</TR>
                ))
              ) : rows.length === 0 ? (
                <TableEmpty
                  colSpan={7}
                  icon={<Receipt size={22} />}
                  title={t("কোনো মিল পাওয়া যায়নি", "No matches")}
                  description={t("ফিল্টার সরিয়ে দেখুন", "Try clearing the filters")}
                />
              ) : (
                rows.map((r) => (
                  <TR key={r.id} className={sel.has(r.id) ? "bg-danger-bg/40" : undefined}>
                    <TD>
                      <Checkbox
                        checked={sel.has(r.id)}
                        onChange={() => sel.toggle(r.id)}
                        aria-label={t(`${r.name_bn} নির্বাচন`, `Select ${r.name_en}`)}
                      />
                    </TD>
                    <TD className="text-sm font-medium text-text-primary">{isBn ? r.name_bn : r.name_en}</TD>
                    <TD className="font-latin text-meta text-text-secondary tnum">{r.code ? n(r.code) : "—"}</TD>
                    <TD className="text-meta text-text-secondary">{r.heads || "—"}</TD>
                    <TD className="text-meta text-text-muted">{r.period ?? "—"}</TD>
                    <TD className="text-right text-sm font-bold text-text-primary tnum">৳{n(r.due)}</TD>
                    <TD className="text-center"><Badge tone="warning">{r.status}</Badge></TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>

          {sel.count > 0 ? (
            <p className="text-meta text-text-secondary">
              {t(`${n(sel.count)} টি নির্বাচিত`, `${sel.count} selected`)} ·{" "}
              {t(`এই পাতায় ৳${n(selectedTotal)}`, `৳${n(selectedTotal)} on this page`)}
            </p>
          ) : null}

          {total > ds.perPage ? (
            <Pagination
              label={t(
                `${n(ds.from)}–${n(ds.to(total))} দেখানো হচ্ছে · মোট ${n(total)}`,
                `Showing ${ds.from}-${ds.to(total)} of ${total}`,
              )}
              pages={ds.pages(total)}
              current={ds.page}
              onPageChange={ds.setPage}
            />
          ) : null}
        </>
      )}

      {/* Typed confirmation, not a yes/no: this voids institution-wide invoices
          irreversibly, and a plain confirm carried the same weight as dismissing
          a toast (audit B-2). */}
      <DangerConfirm
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={doDelete}
        count={sel.count}
        title={t("নির্বাচিত ফি মুছবেন?", "Delete selected fees?")}
        description={t(
          `${n(sel.count)} টি ফি ইনভয়েস স্থায়ীভাবে অকার্যকর হবে। এটি ফেরানো যাবে না।`,
          `${sel.count} fee invoices will be permanently voided. This cannot be undone.`,
        )}
        preview={rows
          .filter((r) => sel.has(r.id))
          .slice(0, 8)
          .map((r) => `${isBn ? r.name_bn : r.name_en} · ৳${n(r.due)}`)
          .join(" · ")}
        typeToConfirmLabel={(phrase) =>
          t(`নিশ্চিত করতে ${n(Number(phrase))} টাইপ করুন`, `Type ${phrase} to confirm`)
        }
        confirmLabel={t("হ্যাঁ, মুছুন", "Yes, delete")}
        cancelLabel={t("বাতিল", "Cancel")}
        loading={del.isPending}
      />
    </div>
  );
}
