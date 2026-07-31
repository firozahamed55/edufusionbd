"use client";

import { useState } from "react";
import { Search, Percent, CheckCircle2, AlertTriangle, Hash, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { Field, Select, Input, Button, Skeleton, EmptyState, ErrorState, PageHeader } from "@/shared/ui";
import { useClassSectionsLookup } from "@/shared/services/lookups/hooks";
import type { Option } from "@/shared/services/lookups/api";
import { useAttendanceSummary } from "../../logic/hooks";
import { useErrorMessage } from "@/shared/services/errors";
import { localDay } from "@/shared/lib/format";

// Institution-time day boundaries (UTC would report yesterday after 18:00 local).
const iso = (d: Date) => localDay(d);
const rateTone = (r: number) => (r >= 90 ? "text-success-fg" : r >= 75 ? "text-warning-fg" : "text-danger-fg");

/** Attendance · Report — live per-student monthly attendance summary. */
export function ReportScreen() {
  const { t, n, isBn } = useT();
  const msg = useErrorMessage();
  const today = new Date();
  const [sectionId, setSectionId] = useState("");
  const [from, setFrom] = useState(iso(new Date(today.getTime() - 30 * 864e5)));
  const [to, setTo] = useState(iso(today));
  const [applied, setApplied] = useState<{ s: string; f: string; t: string } | null>(null);

  const sections = useClassSectionsLookup();
  const q = useAttendanceSummary(applied?.s ?? null, applied?.f ?? "", applied?.t ?? "", Boolean(applied?.s));
  const opt = (list?: Option[]) => (list ?? []).map((o) => ({ value: o.value, label: isBn ? o.label_bn : o.label_en }));
  const d = q.data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        crumbs={[{ label: t("একাডেমিক", "Academic") }, { label: t("উপস্থিতি রিপোর্ট", "Attendance Report") }]}
        title={t("উপস্থিতি রিপোর্ট", "Attendance Report")}
        subtitle={t("শ্রেণি ও তারিখ অনুযায়ী উপস্থিতির সারসংক্ষেপ", "Attendance summary by class and date range")}
      />

      <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-surface p-5 shadow-e1">
        <Field label={t("শ্রেণি ও শাখা", "Class & section")} required className="w-65 max-w-full">
          <Select value={sectionId} placeholder={t("নির্বাচন করুন", "Select")} options={opt(sections.data)} onChange={(e) => setSectionId(e.target.value)} />
        </Field>
        <Field label={t("শুরুর তারিখ", "Start date")} className="w-45"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label={t("শেষ তারিখ", "End date")} className="w-45"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <Button variant="primary" className="h-10.5 px-6" onClick={() => sectionId && setApplied({ s: sectionId, f: from, t: to })}><Search size={16} /> {t("অনুসন্ধান", "Search")}</Button>
      </div>

      {!applied ? (
        <EmptyState icon={<Users size={22} />} title={t("একটি শ্রেণি নির্বাচন করে অনুসন্ধান করুন", "Select a class and search")} />
      ) : q.isLoading ? (
        <div className="flex flex-col gap-2 rounded-2xl bg-surface p-5 shadow-e1">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-11" />)}</div>
      ) : q.isError ? (
        <ErrorState title={t("রিপোর্ট লোড করা যায়নি", "Could not load report")} description={msg(q.error)} />
      ) : d ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SoftStat tone="success" icon={Percent} value={`${n(d.avg_rate)}%`} label={t("গড় উপস্থিতির হার", "Average rate")} />
            <SoftStat tone="primary" icon={CheckCircle2} value={n(d.regular_count)} label={t("নিয়মিত (≥৯০%)", "Regular (≥90%)")} />
            <SoftStat tone="danger" icon={AlertTriangle} value={n(d.at_risk_count)} label={t("ঝুঁকিপূর্ণ (<৭৫%)", "At risk (<75%)")} />
            <SoftStat tone="info" icon={Hash} value={n(d.working_days)} label={t("মোট কার্যদিবস", "Working days")} />
          </div>

          <div className="overflow-hidden rounded-2xl border border-border-default bg-surface shadow-e1">
            <div className="flex items-center gap-3 border-b border-border-default px-5 py-4">
              <p className="flex-1 text-base font-semibold text-text-primary">{t("শিক্ষার্থী তালিকা", "Student list")}</p>
              <span className="text-meta font-semibold text-primary">{t("মোট", "Total")}: {n(d.students.length)}</span>
            </div>
            <div className="flex items-center gap-3 px-5 pt-4 pb-2 text-meta font-semibold text-text-muted">
              <div className="w-35">{t("আইডি", "ID")}</div>
              <div className="w-17.5">{t("রোল", "Roll")}</div>
              <div className="flex-1">{t("নাম", "Name")}</div>
              <div className="w-37.5">{t("উপস্থিতি / কার্যদিবস", "Present / days")}</div>
              <div className="w-30 text-right">{t("উপস্থিতির হার", "Rate")}</div>
            </div>
            {d.students.length === 0 ? (
              <div className="p-5"><EmptyState title={t("এই সময়ে কোনো উপস্থিতি রেকর্ড নেই", "No attendance records in this range")} /></div>
            ) : d.students.map((r, i) => (
              <div key={`${r.code}-${i}`} className={cn("flex items-center gap-3 px-5 py-3.5", i % 2 === 1 && "bg-sunken")}>
                <div className="w-35 font-latin text-meta font-medium text-text-secondary tnum">{r.code ? n(r.code) : "—"}</div>
                <div className="w-17.5 text-meta text-text-secondary tnum">{r.roll != null ? n(r.roll) : "—"}</div>
                <div className="flex-1 text-sm font-medium text-text-primary">{isBn ? r.name_bn : r.name_en}</div>
                <div className="w-37.5 text-meta text-text-secondary tnum">{n(r.present)} / {n(r.total)}</div>
                <div className={cn("w-30 text-right text-sm font-bold tnum", rateTone(r.rate))}>{n(r.rate)}%</div>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

const softTone = { success: "bg-success-bg text-success-fg", primary: "bg-primary-subtle text-primary", danger: "bg-danger-bg text-danger-fg", info: "bg-info-bg text-info-fg" } as const;
function SoftStat({ tone, icon: Icon, value, label }: { tone: keyof typeof softTone; icon: LucideIcon; value: string; label: string }) {
  return (
    <div className="flex items-center gap-3.5 rounded-2xl bg-surface p-5 shadow-e1">
      <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", softTone[tone])}><Icon size={22} /></span>
      <div className="min-w-0"><p className="text-2xl font-bold text-text-primary tnum">{value}</p><p className="truncate text-meta text-text-muted">{label}</p></div>
    </div>
  );
}
