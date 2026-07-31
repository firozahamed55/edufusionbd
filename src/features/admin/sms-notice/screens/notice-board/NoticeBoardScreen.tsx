"use client";

import { useState } from "react";
import { Plus, Trash2, Megaphone } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import {
  Field, Input, Select, Textarea, Button, EmptyState, ErrorState, Skeleton,
  ConfirmDialog, useToast, PageHeader, Pagination, LiveRegion, DataToolbar,
} from "@/shared/ui";
import { useDataScreen } from "@/shared/lib/useDataScreen";
import { exportCsv } from "@/shared/lib/exportCsv";
import { formatDate, localDay } from "@/shared/lib/format";
import { PAGE_SIZE, pageCount } from "@/shared/services/supabase/paging";
import { useNotices, useUpsertNotice, useDeleteNotice } from "../../logic/hooks";
import { useErrorMessage } from "@/shared/services/errors";

const AUDIENCES = [
  { value: "all_parents", bn: "সকল অভিভাবক", en: "All parents" },
  { value: "all_students", bn: "সকল শিক্ষার্থী", en: "All students" },
  { value: "class_wise", bn: "শ্রেণিভিত্তিক", en: "Class-wise" },
];
const STATUSES = [
  { value: "published", bn: "প্রকাশিত", en: "Published" },
  { value: "scheduled", bn: "নির্ধারিত", en: "Scheduled" },
  { value: "urgent", bn: "জরুরি", en: "Urgent" },
  { value: "draft", bn: "খসড়া", en: "Draft" },
];
const statusTone: Record<string, string> = { published: "bg-success-bg text-success-fg", scheduled: "bg-info-bg text-info-fg", urgent: "bg-danger-bg text-danger-fg", draft: "bg-sunken text-text-secondary" };
const lab = (arr: { value: string; bn: string; en: string }[], v: string | null, isBn: boolean) => arr.find((x) => x.value === v)?.[isBn ? "bn" : "en"] ?? v ?? "—";

/**
 * SMS & Notice · Notice Board — publish and manage notices.
 *
 * On the data-interaction contract (SRA A-0.1). Search and the status filter
 * are server-side and URL-backed: the board only grows, so filtering the
 * fetched page would quietly answer "no such notice" for anything older than
 * the newest twenty.
 *
 * Still cards, not a table. A notice is a title, a body and an audience — three
 * fields of prose, one of which wraps. The contract is about state and
 * addressability, not about turning everything into rows.
 */
export function NoticeBoardScreen() {
  const { t, n, isBn } = useT();
  const msg = useErrorMessage();
  const toast = useToast();
  const ds = useDataScreen({ filters: { status: "" }, perPage: PAGE_SIZE });
  const notices = useNotices({ page: ds.page, q: ds.debouncedQ, status: ds.filters.status });
  const upsert = useUpsertNotice();
  const del = useDeleteNotice();
  const [f, setF] = useState({ title: "", body: "", audience: "all_parents", event_date: "", status: "published" });
  const up = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const [delId, setDelId] = useState<string | null>(null);

  function add() {
    if (!f.title.trim()) { toast({ title: t("শিরোনাম আবশ্যক", "Title required"), variant: "error" }); return; }
    upsert.mutate(f, { onSuccess: () => { toast({ title: t("নোটিশ প্রকাশিত হয়েছে", "Notice published"), variant: "success" }); setF({ title: "", body: "", audience: "all_parents", event_date: "", status: "published" }); }, onError: (e: unknown) => toast({ title: msg(e, { bn: "সংরক্ষণ ব্যর্থ", en: "Save failed" }), variant: "error" }) });
  }
  function remove() { if (!delId) return; const id = delId; setDelId(null); del.mutate(id, { onSuccess: () => toast({ title: t("নোটিশ সরানো হয়েছে", "Notice archived"), variant: "success" }), onError: (e: unknown) => toast({ title: msg(e), variant: "error" }) }); }

  const rows = notices.data?.rows ?? [];
  const total = notices.data?.total ?? 0;
  const pages = pageCount(total);
  return (
    <div className="flex flex-col gap-5 pb-6">
      <LiveRegion
        message={
          notices.isLoading
            ? t("লোড হচ্ছে", "Loading notices")
            : t(`${n(total)} টি নোটিশ পাওয়া গেছে`, `${total} notices found`)
        }
      />

      <PageHeader
        crumbs={[{ label: t("SMS ও নোটিশ", "SMS & Notice"), href: "/admin/sms-notice/send" }, { label: t("নোটিশ বোর্ড", "Notice Board") }]}
        title={t("নোটিশ বোর্ড", "Notice Board")}
        subtitle={t("নোটিশ প্রকাশ ও ব্যবস্থাপনা করুন", "Publish and manage notices")}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[380px_1fr]">
        <div className="flex flex-col gap-4 rounded-2xl bg-surface p-5 shadow-e1">
          <div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-lg bg-primary-subtle text-primary"><Plus size={16} /></span><p className="text-base font-semibold text-text-primary">{t("নতুন নোটিশ", "New notice")}</p></div>
          <Field label={t("শিরোনাম", "Title")} required><Input value={f.title} onChange={(e) => up("title", e.target.value)} /></Field>
          <Field label={t("বিবরণ", "Body")}><Textarea value={f.body} onChange={(e) => up("body", e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("প্রাপক", "Audience")}><Select value={f.audience} options={AUDIENCES.map((x) => ({ value: x.value, label: isBn ? x.bn : x.en }))} onChange={(e) => up("audience", e.target.value)} /></Field>
            <Field label={t("স্ট্যাটাস", "Status")}><Select value={f.status} options={STATUSES.map((x) => ({ value: x.value, label: isBn ? x.bn : x.en }))} onChange={(e) => up("status", e.target.value)} /></Field>
          </div>
          <Field label={t("ইভেন্ট তারিখ", "Event date")}><Input type="date" value={f.event_date} onChange={(e) => up("event_date", e.target.value)} /></Field>
          <Button variant="primary" onClick={add} disabled={upsert.isPending}><Plus size={16} /> {upsert.isPending ? t("প্রকাশ…", "Publishing…") : t("প্রকাশ করুন", "Publish")}</Button>
        </div>

        <div className="flex flex-col gap-3">
          <DataToolbar
            q={ds.q}
            onQChange={ds.setQ}
            placeholder={t("শিরোনাম বা বিবরণ খুঁজুন", "Search title or body")}
            searchLabel={t("নোটিশ খুঁজুন", "Search notices")}
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
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{isBn ? s.bn : s.en}</option>
                ))}
              </select>
            }
            onExportPage={() =>
              exportCsv(
                `notices-${localDay()}.csv`,
                rows.map((r) => ({
                  Title: r.title,
                  Body: r.body ?? "",
                  Audience: lab(AUDIENCES, r.audience, false),
                  EventDate: r.event_date ?? "",
                  Status: lab(STATUSES, r.status, false),
                })),
              )
            }
            exportPageCount={rows.length}
          />

          {notices.isError ? (
            <ErrorState title={t("নোটিশ লোড করা যায়নি", "Could not load notices")} description={msg(notices.error)} />
          ) : notices.isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
          ) : rows.length === 0 ? (
            <div className="rounded-2xl bg-surface p-5 shadow-e1">
              <EmptyState
                icon={<Megaphone size={22} />}
                title={ds.isFiltered ? t("কোনো মিল পাওয়া যায়নি", "No matches") : t("কোনো নোটিশ নেই", "No notices yet")}
                description={ds.isFiltered ? t("ফিল্টার সরিয়ে দেখুন", "Try clearing the filters") : undefined}
              />
            </div>
          ) : rows.map((r) => (
            <div key={r.id} className="flex items-start gap-3 rounded-2xl bg-surface p-5 shadow-e1">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-text-primary">{r.title}</p><span className={cn("rounded-full px-2 py-0.5 text-micro font-semibold", statusTone[r.status] ?? "bg-sunken text-text-secondary")}>{lab(STATUSES, r.status, isBn)}</span></div>
                {r.body ? <p className="mt-1 line-clamp-2 text-meta text-text-muted">{r.body}</p> : null}
                {/* Institution time, via shared/lib/format — a notice dated
                    "12 Feb" must read the same to the office and to a parent
                    whose phone is in another timezone (Phase 1, A-0.8). */}
                <p className="mt-1.5 text-xs text-text-muted">{lab(AUDIENCES, r.audience, isBn)}{r.event_date ? ` · ${formatDate(r.event_date)}` : ""}</p>
              </div>
              <button onClick={() => setDelId(r.id)} aria-label={t("মুছুন", "Delete")} className="grid size-8 shrink-0 place-items-center rounded-lg text-danger-fg hover:bg-sunken"><Trash2 size={16} /></button>
            </div>
          ))}
          {pages > 1 ? (
            <div className="rounded-2xl border border-border-default bg-surface shadow-e1">
              <Pagination
                label={t(
                  `${n(ds.from)}–${n(ds.to(total))} দেখানো হচ্ছে · মোট ${n(total)} নোটিশ`,
                  `Showing ${ds.from}-${ds.to(total)} of ${total}`,
                )}
                pages={pages}
                current={ds.page}
                perPage={PAGE_SIZE}
                onPageChange={ds.setPage}
              />
            </div>
          ) : null}
        </div>
      </div>

      <ConfirmDialog open={!!delId} onClose={() => setDelId(null)} onConfirm={remove} tone="danger" title={t("নোটিশ সরাবেন?", "Archive notice?")} confirmLabel={t("সরান", "Archive")} cancelLabel={t("বাতিল", "Cancel")} loading={del.isPending} />
    </div>
  );
}
