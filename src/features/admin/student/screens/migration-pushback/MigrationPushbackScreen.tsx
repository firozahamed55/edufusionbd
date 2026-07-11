"use client";

import { useState } from "react";
import { ChevronRight, AlertTriangle, RotateCcw, History } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { Button, FormCard, Field, Select, SaveBar, Skeleton, EmptyState, ErrorState, ConfirmDialog, useToast } from "@/shared/ui";
import { useMigrationBatches, useMigrationBatchStudents, usePushbackMigration } from "../../logic/hooks";

/**
 * Student · Migration Pushback — reverse a completed migration batch (also serves
 * as migration history). Live: batch list from Supabase → affected students →
 * fn_pushback_migration (transaction-safe reversal, institution-guarded).
 */
export function MigrationPushbackScreen() {
  const { t, n, isBn } = useT();
  const toast = useToast();
  const [batchId, setBatchId] = useState("");
  const [confirm, setConfirm] = useState(false);

  const batches = useMigrationBatches();
  const affected = useMigrationBatchStudents(batchId || null);
  const pushback = usePushbackMigration();

  const selectedBatch = (batches.data ?? []).find((b) => b.id === batchId);

  function reverse() {
    setConfirm(false);
    pushback.mutate(batchId, {
      onSuccess: (count) => {
        toast({ title: t(`${count} জন শিক্ষার্থী পূর্ববর্তী শ্রেণিতে ফিরেছে`, `${count} students reverted`), variant: "success" });
        setBatchId("");
      },
      onError: (e: unknown) => toast({ title: e instanceof Error ? e.message : t("পুশব্যাক ব্যর্থ", "Pushback failed"), variant: "error" }),
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <div className="flex items-center gap-1 text-[13px] text-text-muted">
          <span>{t("মাইগ্রেশন", "Migration")}</span>
          <ChevronRight size={14} />
          <span className="text-text-secondary">{t("পুশব্যাক", "Pushback")}</span>
        </div>
        <h1 className="mt-1.5 text-[22px] font-bold text-text-primary">{t("মাইগ্রেশন পুশব্যাক", "Migration Pushback")}</h1>
        <p className="mt-1 text-[13px] text-text-muted">{t("সম্পন্ন মাইগ্রেশন ব্যাচ পূর্বাবস্থায় ফিরিয়ে আনুন", "Reverse a completed migration batch")}</p>
      </header>

      <FormCard title={t("মাইগ্রেশন ব্যাচ নির্বাচন", "Select Migration Batch")}>
        {batches.isLoading ? (
          <Skeleton className="h-11" />
        ) : batches.isError ? (
          <ErrorState title={t("ব্যাচ লোড করা যায়নি", "Could not load batches")} />
        ) : (batches.data ?? []).length === 0 ? (
          <EmptyState icon={<History size={22} />} title={t("কোনো সম্পন্ন মাইগ্রেশন নেই", "No completed migrations")} description={t("মাইগ্রেশন চালানো হলে এখানে ব্যাচ দেখা যাবে।", "Batches appear here once a migration runs.")} />
        ) : (
          <Field label={t("ব্যাচ", "Batch")}>
            <Select value={batchId} placeholder={t("নির্বাচন করুন", "Select")} onChange={(e) => setBatchId(e.target.value)}
              options={(batches.data ?? []).map((b) => ({
                value: b.id,
                label: `${b.source_label} → ${b.target_label} · ${b.type === "merit" ? t("মেধাক্রমসহ", "merit") : t("মেধাক্রম ছাড়া", "no-merit")} · ${n(b.count)} ${t("জন", "students")}`,
              }))} />
          </Field>
        )}
      </FormCard>

      {batchId && selectedBatch ? (
        <>
          <div className="flex items-start gap-2.5 rounded-xl border border-danger-fg/30 bg-danger-bg px-4 py-3 text-[13px] leading-relaxed text-danger-fg">
            <AlertTriangle size={17} className="mt-0.5 shrink-0" />
            <p>
              <span className="font-semibold">{t("সতর্কতা:", "Warning:")}</span>{" "}
              {t("পুশব্যাক নির্বাচিত শিক্ষার্থীদের পূর্ববর্তী শ্রেণি ও রোলে ফিরিয়ে দেবে এবং অডিট লগে রেকর্ড হবে।", "Pushback reverts the selected students to their previous class and roll, and is recorded in the audit log.")}
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl bg-surface shadow-e3">
            <div className="border-b border-border-default px-5 py-4">
              <p className="text-base font-semibold text-text-primary">
                {t("প্রভাবিত শিক্ষার্থী", "Affected Students")} — {selectedBatch.target_label} → {selectedBatch.source_label}
              </p>
            </div>
            {affected.isLoading ? (
              <div className="flex flex-col gap-2 p-5">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : (affected.data ?? []).length === 0 ? (
              <div className="p-5"><EmptyState title={t("কোনো রেকর্ড নেই", "No records")} /></div>
            ) : (
              <>
                <div className="flex items-center gap-3 px-5 pt-4 pb-2 text-[12.5px] font-semibold text-text-muted">
                  <div className="flex-1">{t("শিক্ষার্থী", "Student")}</div>
                  <div className="w-24 text-right">{t("পুরাতন রোল", "Old Roll")}</div>
                  <div className="w-24 text-right">{t("নতুন রোল", "New Roll")}</div>
                  <div className="w-28">{t("ফলাফল", "Result")}</div>
                </div>
                {(affected.data ?? []).map((r, i) => (
                  <div key={i} className={cn("flex items-center gap-3 px-5 py-3.5", i % 2 === 1 && "bg-sunken")}>
                    <div className="flex-1 text-sm font-medium text-text-primary">{isBn ? r.name_bn : r.name_en}</div>
                    <div className="w-24 text-right text-[13px] text-text-secondary tnum">{r.old_roll != null ? n(r.old_roll) : "—"}</div>
                    <div className="w-24 text-right text-[13px] text-text-secondary tnum">{r.new_roll != null ? n(r.new_roll) : "—"}</div>
                    <div className="w-28">
                      <span className={cn("inline-block rounded-full px-2.5 py-1 text-xs font-semibold", r.result === "pass" || !r.result ? "bg-success-bg text-success-fg" : "bg-danger-bg text-danger-fg")}>
                        {r.result === "fail" ? t("অকৃতকার্য", "Failed") : t("উত্তীর্ণ", "Passed")}
                      </span>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          <SaveBar status={<span>{t(`${selectedBatch.count} জন শিক্ষার্থী পূর্ববর্তী শ্রেণিতে ফিরে যাবে`, `${selectedBatch.count} students will return to their previous class`)}</span>}>
            <Button variant="secondary" onClick={() => setBatchId("")} disabled={pushback.isPending}><RotateCcw size={15} /> {t("রিসেট", "Reset")}</Button>
            <Button variant="danger" onClick={() => setConfirm(true)} disabled={pushback.isPending}>{pushback.isPending ? t("চলছে…", "Running…") : t("মাইগ্রেশন ফিরিয়ে আনুন", "Reverse Migration")}</Button>
          </SaveBar>
        </>
      ) : null}

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={reverse}
        tone="danger"
        title={t("মাইগ্রেশন ফিরিয়ে আনবেন?", "Reverse this migration?")}
        description={t("এই কাজটি নির্বাচিত শিক্ষার্থীদের পূর্ববর্তী শ্রেণিতে ফিরিয়ে দেবে।", "This will move the affected students back to their previous class.")}
        confirmLabel={t("হ্যাঁ, ফিরিয়ে আনুন", "Yes, reverse")}
        cancelLabel={t("বাতিল", "Cancel")}
        loading={pushback.isPending}
      />
    </div>
  );
}
