"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Trash2, Receipt } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { Checkbox, Skeleton, EmptyState, ErrorState, DangerConfirm, useToast, PageHeader, Pagination } from "@/shared/ui";
import { useAppliedFees, useDeleteFeeInvoices } from "../../logic/hooks";
import { APPLIED_FEE_PAGE_SIZE } from "../../logic/api";
import { useErrorMessage } from "@/shared/services/errors";

/** Fee · Delete Fees — live applied-fee invoices, multi-select destructive delete. */
export function DeleteFeesScreen() {
  const { t, n, isBn } = useT();
  const msg = useErrorMessage();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const q = useAppliedFees(page);
  const del = useDeleteFeeInvoices();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState(false);

  const rows = useMemo(() => q.data?.rows ?? [], [q.data]);
  const total = q.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / APPLIED_FEE_PAGE_SIZE));
  // Selection is intentionally NOT cleared on page change: the operator may want
  // to void invoices spanning pages, and `fn_delete_fee_invoice` takes a list.
  // `selectedTotal` therefore sums only what is visible — the count is authoritative.
  const selectedTotal = useMemo(() => rows.filter((r) => selected.has(r.id)).reduce((s, r) => s + r.due, 0), [rows, selected]);
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () =>
    setSelected((p) => {
      const nx = new Set(p);
      for (const r of rows) {
        if (allSelected) nx.delete(r.id);
        else nx.add(r.id);
      }
      return nx;
    });
  const toggleOne = (id: string) => setSelected((p) => { const nx = new Set(p); if (nx.has(id)) nx.delete(id); else nx.add(id); return nx; });

  function doDelete() {
    setConfirm(false);
    del.mutate([...selected], {
      onSuccess: (count) => { toast({ title: t(`${count} টি ফি মুছে ফেলা হয়েছে`, `${count} fees deleted`), variant: "success" }); setSelected(new Set()); },
      onError: (e: unknown) => toast({ title: msg(e, { bn: "মুছে ফেলা ব্যর্থ", en: "Delete failed" }), variant: "error" }),
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        crumbs={[{ label: t("ফি ও অর্থ", "Fees & Finance"), href: "/admin/fee/quick-collection-list" }, { label: t("ফি মুছুন", "Delete Fees") }]}
        title={t("ফি মুছুন", "Delete Fees")}
        subtitle={t("ভুলবশত আরোপিত ফি অপসারণ", "Remove mistakenly applied fees")}
      />

      <div className="flex items-start gap-3 rounded-xl border border-danger-fg/40 bg-danger-bg p-4 text-danger-fg">
        <AlertTriangle size={20} className="mt-0.5 shrink-0" />
        <p className="text-meta font-medium leading-relaxed">{t("সতর্কতা: মুছে ফেলা ফি অকার্যকর (void) হবে এবং তালিকা থেকে সরিয়ে ফেলা হবে।", "Warning: deleted fees are voided and removed from the list.")}</p>
      </div>

      {q.isLoading ? (
        <div className="flex flex-col gap-2 rounded-2xl bg-surface p-5 shadow-e1">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-11" />)}</div>
      ) : q.isError ? (
        <ErrorState title={t("তালিকা লোড করা যায়নি", "Could not load list")} description={msg(q.error)} />
      ) : rows.length === 0 ? (
        <EmptyState icon={<Receipt size={22} />} title={t("কোনো আরোপিত ফি নেই", "No applied fees")} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border-default bg-surface shadow-e1">
          <div className="min-w-205">
            <div className="flex items-center gap-3 border-b border-border-default px-5 py-4">
              <p className="flex-1 text-base font-semibold text-text-primary">{t("আরোপিত ফি তালিকা", "Applied fees")}</p>
              <span className="text-meta font-semibold text-primary">{t("মোট", "Total")}: {n(total)}</span>
            </div>
            <div className="flex items-center gap-3 border-b border-border-default px-5 py-3 text-meta font-semibold text-text-muted">
              <div className="flex w-6 items-center"><Checkbox checked={allSelected} onChange={toggleAll} aria-label={t("সব নির্বাচন", "Select all")} /></div>
              <div className="flex-1">{t("শিক্ষার্থী", "Student")}</div>
              <div className="w-30">{t("আইডি", "ID")}</div>
              <div className="w-40">{t("ফি হেড", "Fee heads")}</div>
              <div className="w-25">{t("সময়কাল", "Period")}</div>
              <div className="w-22.5 text-right">{t("বকেয়া", "Due")}</div>
              <div className="w-22.5 text-center">{t("স্ট্যাটাস", "Status")}</div>
            </div>
            {rows.map((r) => {
              const checked = selected.has(r.id);
              return (
                <div key={r.id} className={cn("flex items-center gap-3 px-5 py-3.5 border-b border-border-default last:border-0", checked && "bg-danger-bg/40")}>
                  <div className="flex w-6 items-center"><Checkbox checked={checked} onChange={() => toggleOne(r.id)} aria-label={t("নির্বাচন", "Select")} /></div>
                  <div className="flex-1 text-sm font-medium text-text-primary">{isBn ? r.name_bn : r.name_en}</div>
                  <div className="w-30 font-latin text-meta text-text-secondary tnum">{r.code ? n(r.code) : "—"}</div>
                  <div className="w-40 text-meta text-text-secondary">{r.heads || "—"}</div>
                  <div className="w-25 text-meta text-text-muted">{r.period ?? "—"}</div>
                  <div className="w-22.5 text-right text-sm font-bold text-text-primary tnum">৳{n(r.due)}</div>
                  <div className="w-22.5 text-center"><span className="inline-block rounded-full bg-warning-bg px-2.5 py-1 text-xs font-semibold text-warning-fg">{r.status}</span></div>
                </div>
              );
            })}
            <div className="flex flex-wrap items-center gap-3 border-t border-border-default px-5 py-4">
              <span className="flex-1 text-meta text-text-secondary">{t(`${selected.size} টি ফি নির্বাচিত`, `${selected.size} selected`)} · {t("মোট", "Total")} ৳{n(selectedTotal)}</span>
              <button onClick={() => setConfirm(true)} disabled={selected.size === 0 || del.isPending}
                className="flex items-center gap-2 rounded-lg bg-danger-solid px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                <Trash2 size={16} /> {del.isPending ? t("মুছছে…", "Deleting…") : t("নির্বাচিত মুছুন", "Delete selected")}
              </button>
            </div>
          </div>
        </div>
      )}

      {total > 0 ? (
        <Pagination
          label={t(
            `${(page - 1) * APPLIED_FEE_PAGE_SIZE + 1}–${Math.min(page * APPLIED_FEE_PAGE_SIZE, total)} দেখানো হচ্ছে · মোট ${total}`,
            `Showing ${(page - 1) * APPLIED_FEE_PAGE_SIZE + 1}-${Math.min(page * APPLIED_FEE_PAGE_SIZE, total)} of ${total}`,
          )}
          pages={pages}
          current={page}
          onPageChange={setPage}
        />
      ) : null}

      {/* Typed confirmation, not a yes/no: this voids institution-wide invoices
          irreversibly, and a plain confirm carried the same weight as dismissing
          a toast (audit B-2). */}
      <DangerConfirm
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={doDelete}
        count={selected.size}
        title={t("নির্বাচিত ফি মুছবেন?", "Delete selected fees?")}
        description={t(
          `${n(selected.size)} টি ফি ইনভয়েস স্থায়ীভাবে অকার্যকর হবে। এটি ফেরানো যাবে না।`,
          `${selected.size} fee invoices will be permanently voided. This cannot be undone.`,
        )}
        preview={rows
          .filter((r) => selected.has(r.id))
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
