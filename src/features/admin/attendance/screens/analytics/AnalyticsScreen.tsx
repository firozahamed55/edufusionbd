"use client";

import { useState } from "react";
import { Search, Percent, CheckCircle2, AlertTriangle, Hash, Send, type LucideIcon } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { Field, Select, Input, Button, Skeleton, EmptyState, ErrorState, PageHeader } from "@/shared/ui";
import { useClassSectionsLookup } from "@/shared/services/lookups/hooks";
import type { Option } from "@/shared/services/lookups/api";
import { useAttendanceSummary } from "../../logic/hooks";
import { useErrorMessage } from "@/shared/services/errors";

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Attendance · Analytics — live status split, KPIs and at-risk students. */
export function AnalyticsScreen() {
  const { t, n, isBn } = useT();
  const msg = useErrorMessage();
  const today = new Date();
  const [sectionId, setSectionId] = useState("");
  const [from, setFrom] = useState(iso(new Date(today.getTime() - 30 * 864e5)));
  const [to, setTo] = useState(iso(today));
  const [applied, setApplied] = useState<{ s: string; f: string; t: string } | null>({ s: "", f: iso(new Date(today.getTime() - 30 * 864e5)), t: iso(today) });

  const sections = useClassSectionsLookup();
  const q = useAttendanceSummary(applied?.s || null, applied?.f ?? "", applied?.t ?? "", applied != null);
  const opt = (list?: Option[]) => (list ?? []).map((o) => ({ value: o.value, label: isBn ? o.label_bn : o.label_en }));
  const d = q.data;

  const SPLIT = d ? [
    { key: "present", bn: "উপস্থিত", en: "Present", color: "bg-success-fg", v: d.status_split.present },
    { key: "absent", bn: "অনুপস্থিত", en: "Absent", color: "bg-danger-fg", v: d.status_split.absent },
    { key: "late", bn: "দেরি", en: "Late", color: "bg-warning-fg", v: d.status_split.late },
    { key: "leave", bn: "ছুটি", en: "Leave", color: "bg-info-fg", v: d.status_split.leave },
    { key: "exam_absent", bn: "পরীক্ষায় অনুপস্থিত", en: "Exam absent", color: "bg-violet-600", v: d.status_split.exam_absent },
  ] : [];
  const splitTotal = SPLIT.reduce((s, x) => s + x.v, 0) || 1;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        crumbs={[{ label: t("একাডেমিক", "Academic") }, { label: t("উপস্থিতি বিশ্লেষণ", "Attendance Analytics") }]}
        title={t("উপস্থিতি বিশ্লেষণ", "Attendance Analytics")}
        subtitle={t("উপস্থিতির প্রবণতা ও ঝুঁকি বিশ্লেষণ", "Attendance trends & risk analysis")}
      />

      <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-surface p-5 shadow-e3">
        <Field label={t("শ্রেণি ও শাখা", "Class & Section")} className="w-65 max-w-full">
          <Select value={sectionId} placeholder={t("সকল শ্রেণি ও শাখা", "All classes & sections")} options={[{ value: "", label: t("সকল শ্রেণি ও শাখা", "All classes & sections") }, ...opt(sections.data)]} onChange={(e) => setSectionId(e.target.value)} />
        </Field>
        <Field label={t("শুরুর তারিখ", "Start date")} className="w-45"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label={t("শেষ তারিখ", "End date")} className="w-45"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <Button variant="primary" className="h-10.5 px-6" onClick={() => setApplied({ s: sectionId, f: from, t: to })}><Search size={16} /> {t("অনুসন্ধান", "Search")}</Button>
      </div>

      {q.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
      ) : q.isError ? (
        <ErrorState title={t("বিশ্লেষণ লোড করা যায়নি", "Could not load analytics")} description={msg(q.error)} />
      ) : d ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SoftStat tone="success" icon={Percent} value={`${n(d.avg_rate)}%`} label={t("গড় উপস্থিতির হার", "Average rate")} />
            <SoftStat tone="primary" icon={CheckCircle2} value={n(d.regular_count)} label={t("নিয়মিত (≥৯০%)", "Regular (≥90%)")} />
            <SoftStat tone="danger" icon={AlertTriangle} value={n(d.at_risk_count)} label={t("ঝুঁকিপূর্ণ (<৭৫%)", "At risk (<75%)")} />
            <SoftStat tone="info" icon={Hash} value={n(d.working_days)} label={t("কার্যদিবস", "Working days")} />
          </div>

          <div className="flex flex-col gap-2 rounded-2xl bg-surface p-5 shadow-e3">
            <p className="text-base font-semibold text-text-primary">{t("স্ট্যাটাস বিভাজন", "Status split")}</p>
            <div className="mt-1 flex h-3 overflow-hidden rounded-full bg-sunken">
              {SPLIT.map((s) => s.v > 0 ? <div key={s.key} className={s.color} style={{ width: `${(s.v / splitTotal) * 100}%` }} /> : null)}
            </div>
            <div className="mt-2 flex flex-col gap-2.5">
              {SPLIT.map((s) => (
                <div key={s.key} className="flex items-center gap-2 text-meta">
                  <span className={cn("size-2.5 rounded-full", s.color)} />
                  <span className="flex-1 text-text-secondary">{t(s.bn, s.en)}</span>
                  <span className="font-semibold text-text-primary tnum">{n(Math.round((s.v / splitTotal) * 100))}%</span>
                  <span className="w-16 text-right text-text-muted tnum">{n(s.v)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl bg-surface shadow-e3">
            <div className="min-w-180">
              <div className="flex items-center gap-2 px-5 pt-5">
                <p className="text-base font-semibold text-text-primary">{t("ঝুঁকিপূর্ণ শিক্ষার্থী", "At-risk students")}</p>
                <span className="rounded-full bg-danger-bg px-2.5 py-1 text-micro font-semibold text-danger-fg">{t("<৭৫% উপস্থিতি", "<75% attendance")}</span>
              </div>
              <div className="mt-3 flex items-center gap-3 border-b border-border-default px-5 py-3 text-meta font-semibold text-text-muted">
                <div className="w-32.5">{t("আইডি", "ID")}</div>
                <div className="flex-1">{t("শিক্ষার্থী", "Student")}</div>
                <div className="w-15">{t("রোল", "Roll")}</div>
                <div className="w-27.5 text-right">{t("অনুপস্থিত", "Absent")}</div>
                <div className="w-27.5 text-right">{t("উপস্থিতির হার", "Rate")}</div>
                <div className="w-32.5 text-right">{t("অ্যাকশন", "Action")}</div>
              </div>
              {d.at_risk.length === 0 ? (
                <div className="p-5"><EmptyState title={t("কোনো ঝুঁকিপূর্ণ শিক্ষার্থী নেই", "No at-risk students")} /></div>
              ) : d.at_risk.map((r, i) => (
                <div key={`${r.code}-${i}`} className={cn("flex items-center gap-3 px-5 py-3.5", i % 2 === 1 && "bg-sunken")}>
                  <div className="w-32.5 font-latin text-meta font-medium text-text-secondary tnum">{r.code ? n(r.code) : "—"}</div>
                  <div className="min-w-0 flex-1 truncate text-sm font-semibold text-text-primary">{isBn ? r.name_bn : r.name_en}</div>
                  <div className="w-15 text-meta text-text-secondary tnum">{r.roll != null ? n(r.roll) : "—"}</div>
                  <div className="w-27.5 text-right text-meta font-semibold text-danger-fg tnum">{n(r.absent)}</div>
                  <div className="w-27.5 text-right text-sm font-bold text-danger-fg tnum">{n(r.rate)}%</div>
                  <div className="flex w-32.5 justify-end">
                    <button disabled className="flex items-center gap-1.5 rounded-lg border border-border-strong bg-surface px-3 py-2 text-meta font-medium text-text-muted opacity-60"><Send size={14} /> {t("SMS", "SMS")}</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

const softTone = { success: "bg-success-bg text-success-fg", primary: "bg-primary-subtle text-primary", danger: "bg-danger-bg text-danger-fg", info: "bg-info-bg text-info-fg" } as const;
function SoftStat({ tone, icon: Icon, value, label }: { tone: keyof typeof softTone; icon: LucideIcon; value: string; label: string }) {
  return (
    <div className="flex items-center gap-3.5 rounded-2xl bg-surface p-5 shadow-e3">
      <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", softTone[tone])}><Icon size={22} /></span>
      <div className="min-w-0"><p className="text-2xl font-bold text-text-primary tnum">{value}</p><p className="truncate text-meta text-text-muted">{label}</p></div>
    </div>
  );
}
