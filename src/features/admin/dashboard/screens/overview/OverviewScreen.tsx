"use client";

import Link from "next/link";
import {
  Users,
  UserCheck,
  Wallet,
  Plus,
  AlertTriangle,
  ShieldAlert,
  ClipboardCheck,
  UserPlus,
  CalendarCheck,
  CreditCard,
  PenSquare,
  Send,
  Megaphone,
  ChevronRight,
  History,
  TrendingUp,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { BarChart, Donut, Skeleton, ErrorState, EmptyState, PageHeader } from "@/shared/ui";
import { useAdminUser } from "@/features/admin/components/useAdminUser";
import { useMyPermissions } from "@/features/admin/core/logic/hooks";
import { SetupChecklist } from "../../components/SetupChecklist";
import { localDay, dayOffset, weekdayShort, formatDateTime } from "@/shared/lib/format";
import { useQueryState } from "@/shared/lib/useQueryState";
import { useDashboard, usePeriodStats } from "./logic/useDashboard";
import { activitySentence, activityHref } from "../../logic/activityLabel";
import type { AttentionItem } from "./logic/api";

/**
 * Admin dashboard overview.
 *
 * Rule from the audit (§10.1): every element is bound to real data, or it does
 * not ship. Roughly 60% of this screen used to be fiction — a hardcoded
 * greeting ("Good morning, Nusrat", always), a fabricated weekly attendance
 * chart, an invented "avg 91% · 1.8% higher" caption, and three priority alerts
 * with made-up ৳ figures — all rendered identically to the three live KPIs
 * beside them, on the surface operators see first and most often.
 */

/**
 * Period presets (SRA A-1: "no period selector"). Ranges are computed in
 * institution time via `shared/lib/format`, never from `toISOString()` — after
 * 18:00 in Dhaka that reports yesterday, which on a "this month" boundary
 * silently shifts the whole window by a month.
 */
type PresetKey = "this_month" | "last_month" | "last_30" | "this_year" | "custom";

const PRESETS: Record<Exclude<PresetKey, "custom">, { bn: string; en: string; collectedBn: string; collectedEn: string }> = {
  this_month: { bn: "এই মাস", en: "This month", collectedBn: "এ মাসে আদায়", collectedEn: "Collected (month)" },
  last_month: { bn: "গত মাস", en: "Last month", collectedBn: "গত মাসে আদায়", collectedEn: "Collected (last month)" },
  last_30: { bn: "গত ৩০ দিন", en: "Last 30 days", collectedBn: "৩০ দিনে আদায়", collectedEn: "Collected (30 days)" },
  this_year: { bn: "এই বছর", en: "This year", collectedBn: "এ বছরে আদায়", collectedEn: "Collected (year)" },
};

/**
 * The window immediately before this one, of the same length (SRA A-1 item 8 —
 * "no period-over-period delta").
 *
 * SAME LENGTH, NOT "the previous calendar month". A custom 9-day range compared
 * against a 30-day one produces a −70% that means nothing, and a head teacher
 * reading it would act on it. Inclusive on both ends, matching `presetRange`.
 */
export function previousRange(from: string, to: string): { from: string; to: string } {
  const days = Math.round(
    (new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime()) / 86_400_000,
  ) + 1;
  const prevTo = dayOffset(-1, `${from}T12:00:00`);
  return { from: dayOffset(-(days - 1), `${prevTo}T12:00:00`), to: prevTo };
}

export function presetRange(
  key: Exclude<PresetKey, "custom">,
  // Injectable so the December→January rollover is testable rather than
  // wall-clock dependent — the same discipline `fetchDashboard` uses for `now`.
  today = localDay(),
): { from: string; to: string } {
  const [y, m] = today.split("-").map(Number);
  const pad = (v: number) => String(v).padStart(2, "0");
  const monthStart = (yy: number, mm: number) => `${yy}-${pad(mm)}-01`;
  // Day 0 of the next month is the last day of this one — no month-length table.
  const monthEnd = (yy: number, mm: number) => localDay(new Date(yy, mm, 0));

  if (key === "last_month") {
    const yy = m === 1 ? y - 1 : y;
    const mm = m === 1 ? 12 : m - 1;
    return { from: monthStart(yy, mm), to: monthEnd(yy, mm) };
  }
  if (key === "last_30") return { from: dayOffset(-30, `${today}T12:00:00`), to: today };
  if (key === "this_year") return { from: `${y}-01-01`, to: today };
  return { from: monthStart(y, m), to: today };
}

const ATTENTION_META: Record<
  string,
  { icon: LucideIcon; cta: { bn: string; en: string }; permission: string }
> = {
  overdue_fees: { icon: AlertTriangle, cta: { bn: "তাগাদা পাঠান", en: "Send reminders" }, permission: "fee.view" },
  attendance_low: { icon: ShieldAlert, cta: { bn: "তালিকা দেখুন", en: "View list" }, permission: "attendance.view" },
  results_pending: { icon: ClipboardCheck, cta: { bn: "পর্যালোচনা", en: "Review" }, permission: "exam.view" },
};

export function OverviewScreen() {
  const { t, n } = useT();
  const { data: me } = useAdminUser();
  const { data, isLoading, isError, refetch } = useDashboard();

  // Period lives in the URL, so "this school in October" is a link (SRA A-1).
  const [{ preset, from, to }, setPeriod] = useQueryState({
    preset: "this_month" as PresetKey,
    ...presetRange("this_month"),
  });
  const period = usePeriodStats(from, to);

  /**
   * Role-aware sections (SRA A-1 item 3 — "an accountant and an exam controller
   * see the same eight sections"). Unblocked now that A-0.4 landed.
   *
   * Same permission codes and the same fail-open rule as the navigation rail:
   * `undefined` (loading) and `[]` (an account never seeded with roles) show
   * everything. A dashboard that hides its own panels on a settings gap reads as
   * a broken product, and RLS — not this — is the control (risk R-5).
   */
  const { data: permissions } = useMyPermissions();
  const can = (code: string) => !permissions || permissions.length === 0 || permissions.includes(code);

  // Period-over-period (SRA A-1 item 8). A second query on the same fetcher —
  // the comparison is the same two numbers over the preceding window.
  const prev = previousRange(from, to);
  const previous = usePeriodStats(prev.from, prev.to);

  const bdt = (v: number) => `৳${n(new Intl.NumberFormat("en-IN").format(Math.round(v)))}`;
  const collected = period.data?.collected ?? 0;
  const due = data?.totalDue ?? 0;
  const collectRate = collected + due > 0 ? Math.round((collected / (collected + due)) * 100) : 0;
  // A hand-typed `?preset=` in the URL is not guaranteed to be a known key.
  const presetMeta = PRESETS[preset as Exclude<PresetKey, "custom">];
  const periodLabel = presetMeta
    ? t(presetMeta.collectedBn, presetMeta.collectedEn)
    : t("এই সময়ে আদায়", "Collected (period)");

  // Real time-of-day, not a hardcoded "Good morning".
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? t("সুপ্রভাত", "Good morning") : hour < 17 ? t("শুভ অপরাহ্ন", "Good afternoon") : t("শুভ সন্ধ্যা", "Good evening");

  const trend = period.data?.attendanceTrend ?? [];
  const avgRate = period.data?.avgRate ?? 0;

  /**
   * A delta is only shown when the previous window HAS data. Against a zero
   * baseline every change is "+100%", which is not a comparison — it is the
   * absence of one, rendered as a triumph. `undefined` means "say nothing".
   */
  const pctChange = (now: number, before: number) =>
    previous.data && before > 0 ? Math.round(((now - before) / before) * 100) : undefined;
  const collectedDelta = pctChange(collected, previous.data?.collected ?? 0);
  const rateDelta =
    previous.data && previous.data.avgRate > 0 && trend.length > 0
      ? avgRate - previous.data.avgRate
      : undefined;
  // Last 7 points, labelled by weekday — a real series over the chosen period,
  // not five invented numbers.
  const chartData = trend.slice(-7).map((p) => ({
    label: weekdayShort(`${p.date}T12:00:00Z`),
    value: p.rate,
    display: n(p.rate),
  }));

  // A quick action to a screen the operator's role cannot open is a dead
  // control with a redirect at the end of it (A-1 item 3).
  const quickActions = [
    { icon: UserPlus, title: t("নতুন শিক্ষার্থী", "New Student"), desc: t("নতুন রেজিস্ট্রেশন", "New registration"), href: "/admin/student/registration", permission: "student.view" },
    { icon: CalendarCheck, title: t("উপস্থিতি নিন", "Take Attendance"), desc: t("দৈনিক উপস্থিতি", "Daily attendance"), href: "/admin/attendance/section", permission: "attendance.view" },
    { icon: CreditCard, title: t("ফি সংগ্রহ", "Collect Fees"), desc: t("পেমেন্ট কালেকশন", "Payment collection"), href: "/admin/fee/quick-collection-list", permission: "fee.view" },
    { icon: PenSquare, title: t("মার্কস এন্ট্রি", "Marks Entry"), desc: t("পরীক্ষার ফলাফল", "Exam results"), href: "/admin/exam/mark-input", permission: "exam.view" },
    { icon: Send, title: t("SMS পাঠান", "Send SMS"), desc: t("বাল্ক মেসেজিং", "Bulk messaging"), href: "/admin/sms-notice/send", permission: "sms.view" },
  ].filter((a) => can(a.permission));

  const studentsPerTeacher = data?.activeTeachers
    ? Math.round((data.activeStudents ?? 0) / data.activeTeachers)
    : 0;

  // Zero students AND zero sections = nothing has been set up, which is a
  // different state from "zero results for your filter" (B-8).
  const isEmptyInstitution = (data?.activeStudents ?? 0) === 0 && (data?.classSections ?? 0) === 0;

  // An unrecognised key stays visible — a new attention rule must not vanish
  // because nobody added it to the meta table.
  const attention = (data?.attention ?? []).filter((a) => {
    const meta = ATTENTION_META[a.key];
    return !meta || can(meta.permission);
  });

  const attentionLabel = (a: AttentionItem) => {
    if (a.key === "overdue_fees")
      return {
        title: t(
          `${bdt(a.amount ?? 0)} ফি বকেয়া · ${n(a.count)} জন`,
          `${bdt(a.amount ?? 0)} overdue · ${a.count} students`,
        ),
        desc: t("নির্ধারিত তারিখ পেরিয়েছে", "Past the due date"),
      };
    if (a.key === "attendance_low")
      return {
        title: t(`গড় উপস্থিতি ${n(a.count)}%`, `Average attendance ${a.count}%`),
        desc: t("গত ৩০ দিনে ৭৫% এর নিচে", "Below 75% over the last 30 days"),
      };
    return {
      title: t(`${n(a.count)} টি পরীক্ষার ফলাফল অপেক্ষমাণ`, `${a.count} exam results awaiting publish`),
      desc: t("মার্ক লক করা হয়েছে, প্রকাশ বাকি", "Marks locked, not yet published"),
    };
  };

  if (isLoading) {
    // Mirrors the real layout (4 KPI + 2 chart + 1 list) so the page does not
    // pop in six extra sections after paint (audit D-8).
    return (
      <div className="flex flex-col gap-5">
        <Skeleton className="h-16 rounded-2xl" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_400px]">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title={t("ড্যাশবোর্ড লোড করা যায়নি", "Couldn't load dashboard")}
        description={t("সংযোগ পরীক্ষা করে আবার চেষ্টা করুন", "Check your connection and try again")}
        action={
          <button
            onClick={() => refetch()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-text-on-primary"
          >
            {t("পুনরায় চেষ্টা", "Retry")}
          </button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Greeting + actions */}
      <div className="flex flex-wrap items-center gap-4">
        <PageHeader
          className="flex-1"
          title={me?.name ? `${greeting}, ${me.name}` : greeting}
          subtitle={t("এক নজরে আপনার স্কুলের চিত্র", "Your school at a glance")}
        />
        {can("student.view") ? (
          <div className="flex items-center gap-2.5">
            <Link href="/admin/student/reports-summary" className="rounded-lg border border-border-control bg-surface px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-sunken">
              {t("প্রতিবেদন", "Report")}
            </Link>
            <Link href="/admin/student/registration" className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-text-on-primary hover:bg-primary-hover">
              <Plus size={16} /> {t("নতুন শিক্ষার্থী", "New Student")}
            </Link>
          </div>
        ) : null}
      </div>

      {/*
        A brand-new institution gets an ordered setup path instead of a wall of
        zeroes and eight sections that cannot possibly have data yet (B-8).
      */}
      {isEmptyInstitution ? (
        <SetupChecklist
          hasClasses={(data?.classSections ?? 0) > 0}
          hasSubjects={(data?.subjects ?? 0) > 0}
          hasStudents={(data?.activeStudents ?? 0) > 0}
        />
      ) : null}

      {/* Needs attention — every row from a live query with a real CTA, and
          only the rows this operator can act on (A-1 item 3). */}
      <Card className="gap-3">
        <div className="flex items-center gap-2">
          <h2 className="flex-1 text-base font-semibold text-text-primary">
            {t("এখন নজর দিন", "Needs attention")}
            {attention.length > 0 ? (
              <span className="ml-2 rounded-full bg-danger-bg px-2 py-0.5 text-micro font-semibold text-danger-fg tnum">
                {n(attention.length)}
              </span>
            ) : null}
          </h2>
        </div>
        {attention.length === 0 ? (
          <p className="py-3 text-sm text-text-muted">
            {t("এই মুহূর্তে কিছু করণীয় নেই।", "Nothing needs your attention right now.")}
          </p>
        ) : (
          attention.map((a) => {
            const meta = ATTENTION_META[a.key];
            const label = attentionLabel(a);
            return (
              <Alert
                key={a.key}
                tone={a.tone}
                icon={meta.icon}
                title={label.title}
                desc={label.desc}
                cta={t(meta.cta.bn, meta.cta.en)}
                ctaTone={a.tone === "danger" ? "danger" : undefined}
                href={a.href}
              />
            );
          })
        )}
      </Card>

      {/* KPIs. Every tile is a link to the list it summarises (SRA A-1 item 2:
          the tiles are the most-looked-at objects on the screen and were dead
          ends — the attention rows below them were already links). */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {can("student.view") ? (
          <Kpi grad="grad-indigo" icon={Users} label={t("মোট শিক্ষার্থী", "Total Students")} value={n(data?.activeStudents ?? 0)} delta={n(data?.classSections ?? 0)} period={t("শ্রেণি-শাখা", "class-sections")} href="/admin/student/update-class" />
        ) : null}
        {/*
          The secondary line is a RATIO, not a count, and it is routinely an
          order of magnitude larger than the headline it sits under (3 teachers,
          89 students per teacher). Rendered as a bold number plus the terse unit
          "students/teacher" it read as a second headline figure — reported from
          the field as "there are 3 teachers but it shows 94". Spelled out as a
          full phrase there is nothing left to misattribute. The other two tiles
          keep the terse form because "9 class-sections" and "৳3,000 due" are
          counts of the thing named, so the number and its unit agree.
        */}
        {can("teacher.view") ? (
          <Kpi grad="grad-emerald" icon={UserCheck} label={t("মোট শিক্ষক", "Total Teachers")} value={n(data?.activeTeachers ?? 0)} delta="" period={t(`প্রতি শিক্ষকে ${n(studentsPerTeacher)} জন শিক্ষার্থী`, `${studentsPerTeacher} students per teacher`)} href="/admin/teacher/list" />
        ) : null}
        {/* The statement for exactly this window — the drill-down of a money
            number is the ledger the number came from, not a generic list. */}
        {can("fee.view") ? (
          <Kpi
            grad="grad-sky"
            icon={Wallet}
            label={periodLabel}
            value={bdt(collected)}
            delta={bdt(due)}
            period={t("বকেয়া", "due")}
            href={`/admin/fee/income-statement?from=${from}&to=${to}`}
            change={collectedDelta}
            changeLabel={t("গত সময়ের তুলনায়", "vs previous period")}
          />
        ) : null}
      </div>

      {/* Analytics. The heading and its selector go with the panels they
          govern — an operator who can see neither gets neither. */}
      {can("attendance.view") || can("fee.view") ? (
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="flex-1 text-base font-semibold text-text-primary">{t("সময়কাল অনুযায়ী", "Over a period")}</h2>
          <PeriodSelector value={preset} from={from} to={to} onChange={setPeriod} />
        </div>
      ) : null}
      {/* The selector governs THESE two panels and the collection tile, and
          nothing else. Enrolment counts and outstanding dues are point-in-time
          facts; a control that appeared to filter them would be reporting a
          falsehood, which is the defect this dashboard was rebuilt to remove. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_400px]">
        {can("attendance.view") ? (
        <Card>
          <CardHead
            title={t("উপস্থিতির হার", "Attendance Rate")}
            subtitle={
              trend.length === 0
                ? t("এই সময়ে কোনো উপস্থিতি রেকর্ড নেই", "No attendance recorded in this period")
                : rateDelta === undefined
                  ? t(`এই সময়ের গড় ${n(avgRate)}%`, `${avgRate}% average over this period`)
                  : t(
                      `এই সময়ের গড় ${n(avgRate)}% · গত সময়ের চেয়ে ${rateDelta >= 0 ? "+" : "−"}${n(Math.abs(rateDelta))} পয়েন্ট`,
                      `${avgRate}% average over this period · ${rateDelta >= 0 ? "+" : "−"}${Math.abs(rateDelta)} points vs the previous period`,
                    )
            }
          />
          {chartData.length > 0 ? (
            <div className="mt-4">
              <BarChart data={chartData} unit="%" max={100} caption={t("দৈনিক উপস্থিতির হার", "Daily attendance rate")} />
            </div>
          ) : (
            <EmptyState
              icon={<CalendarCheck size={22} />}
              title={t("উপস্থিতি নেওয়া শুরু করুন", "Start taking attendance")}
              description={t("উপস্থিতি রেকর্ড হলে এখানে প্রবণতা দেখাবে", "The trend appears here once attendance is recorded")}
            />
          )}
        </Card>
        ) : null}

        {can("fee.view") ? (
        <Card>
          <CardHead title={t("ফি আদায়", "Fee Collection")} />
          <div className="flex items-center justify-center py-2">
            <Donut percent={collectRate} valueLabel={`${n(collectRate)}%`} label={t("আদায় হয়েছে", "collected")} caption={t("ফি আদায়ের হার", "Fee collection rate")} />
          </div>
          <div className="flex flex-col gap-2.5">
            <LegendRow color="bg-primary" label={t("আদায়", "Collected")} value={bdt(collected)} />
            <LegendRow color="bg-border-strong" label={t("বকেয়া", "Due")} value={bdt(due)} />
          </div>
        </Card>
        ) : null}
      </div>

      {/* Activity + quick actions */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_400px]">
        <Card className="gap-2">
          <div className="flex items-center gap-2.5 pb-1">
            <span className="grid size-8 place-items-center rounded-lg bg-primary-subtle text-primary">
              <History size={17} />
            </span>
            <h3 className="flex-1 text-base font-semibold text-text-primary">{t("সাম্প্রতিক কার্যক্রম", "Recent activity")}</h3>
            <Link href="/admin/core/audit-log" className="text-meta font-medium text-primary">
              {t("সব দেখুন", "Full history")}
            </Link>
          </div>
          {(data?.activity.length ?? 0) === 0 ? (
            <p className="py-3 text-sm text-text-muted">{t("কোনো কার্যক্রম নেই", "No activity yet")}</p>
          ) : (
            data?.activity.map((a) => {
              // SRA B-2: a sentence, not `insert · student_enrollment`.
              const s = activitySentence(a.action, a.entity, a.count);
              const href = activityHref(a.entity);
              const label = t(s.bn, s.en);
              const row = (
                <>
                  <span className="min-w-0 flex-1 truncate text-meta text-text-primary">{label}</span>
                  {/* Date AND time — six entries on the same day were previously
                      indistinguishable, all rendering the same bare date. */}
                  <span className="shrink-0 text-xs text-text-muted tnum">{n(formatDateTime(a.at))}</span>
                </>
              );
              return href ? (
                <Link key={a.id} href={href} className="flex items-center gap-3 rounded-xl bg-sunken px-3 py-2.5 transition-colors hover:bg-primary-subtle">
                  {row}
                </Link>
              ) : (
                <div key={a.id} className="flex items-center gap-3 rounded-xl bg-sunken px-3 py-2.5">{row}</div>
              );
            })
          )}
        </Card>

        <Card className="gap-2">
          <h3 className="pb-1 text-base font-semibold text-text-primary">{t("দ্রুত অ্যাকশন", "Quick Actions")}</h3>
          {quickActions.map((a) => (
            <QuickAction key={a.title} {...a} />
          ))}
        </Card>
      </div>

      {/* Notices */}
      <Card className="gap-1">
        <div className="flex items-center pb-1.5">
          <h3 className="flex-1 text-base font-semibold text-text-primary">{t("সাম্প্রতিক নোটিশ", "Recent Notices")}</h3>
          <Link href="/admin/sms-notice/notice-board" className="text-meta font-medium text-primary">{t("+ নতুন", "+ New")}</Link>
        </div>
        <div className="grid grid-cols-1 gap-3.5 pt-1.5 md:grid-cols-3">
          {(data?.notices ?? []).length === 0 ? (
            <p className="col-span-full py-4 text-sm text-text-muted">{t("কোনো নোটিশ নেই", "No notices yet")}</p>
          ) : (
            (data?.notices ?? []).map((no) => (
              <Notice
                key={no.id}
                tone={no.status === "urgent" ? "danger" : no.status === "published" ? "info" : "neutral"}
                icon={Megaphone}
                title={no.title}
                time={no.event_date ? n(no.event_date) : ""}
              />
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

/* ---------- local presentational parts ---------- */

function Kpi({
  grad,
  icon: Icon,
  label,
  value,
  delta,
  period,
  href,
  change,
  changeLabel,
}: {
  grad: string;
  icon: LucideIcon;
  label: string;
  value: string;
  delta: string;
  period: string;
  /** The list this number summarises. A KPI without one is a dead end (A-1). */
  href: string;
  /**
   * Percent change against the same-length previous window (A-1 item 8).
   * `undefined` means there is no comparable baseline — see `pctChange`.
   */
  change?: number;
  changeLabel?: string;
}) {
  const { n } = useT();
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex flex-col gap-3.5 overflow-hidden rounded-2xl px-5 py-4.5 text-white shadow-e2 transition-transform hover:-translate-y-0.5",
        grad,
      )}
    >
      <div className="flex items-center">
        <p className="flex-1 text-meta font-medium">{label}</p>
        <span className="grid size-9 place-items-center rounded-lg bg-white/20">
          <Icon size={20} />
        </span>
      </div>
      <div className="flex flex-wrap items-baseline gap-2">
        <p className="text-3xl font-bold tnum">{value}</p>
        {/*
          A trend arrow ONLY where a genuine period-over-period change exists
          (A-1 item 8). It used to sit beside the secondary metric below, where
          it compared nothing and was actively misleading (audit D-3) — hence
          `change === undefined` rendering nothing at all rather than 0%.
        */}
        {change !== undefined ? (
          <span
            className="flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-meta font-semibold tnum"
            title={changeLabel}
          >
            {change >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            {change >= 0 ? "+" : "−"}{n(Math.abs(change))}%
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-1.5 text-meta">
        {/* Empty `delta` = the tile carries its whole secondary metric in
            `period` as one phrase; an empty bold span would still cost a gap. */}
        {delta ? <span className="font-semibold">{delta}</span> : null}
        <span className="opacity-90">{period}</span>
        <ChevronRight size={14} className="ml-auto opacity-0 transition-opacity group-hover:opacity-90" />
      </div>
    </Link>
  );
}

/**
 * Presets plus a custom range, all URL-backed. The custom inputs apply on
 * change rather than behind a Search button because both ends already have a
 * value — there is no half-typed range to fire against.
 */
function PeriodSelector({
  value,
  from,
  to,
  onChange,
}: {
  value: string;
  from: string;
  to: string;
  onChange: (patch: { preset?: PresetKey; from?: string; to?: string }) => void;
}) {
  const { t } = useT();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={value}
        onChange={(e) => {
          const next = e.target.value as PresetKey;
          onChange(next === "custom" ? { preset: next } : { preset: next, ...presetRange(next) });
        }}
        aria-label={t("সময়কাল", "Period")}
        className="rounded-lg border border-border-strong bg-surface px-3 py-2 text-meta font-medium text-text-secondary"
      >
        {(Object.keys(PRESETS) as Exclude<PresetKey, "custom">[]).map((k) => (
          <option key={k} value={k}>{t(PRESETS[k].bn, PRESETS[k].en)}</option>
        ))}
        <option value="custom">{t("নির্দিষ্ট সময়", "Custom")}</option>
      </select>
      {value === "custom" ? (
        <>
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => onChange({ from: e.target.value })}
            aria-label={t("শুরুর তারিখ", "Start date")}
            className="rounded-lg border border-border-strong bg-surface px-3 py-2 text-meta text-text-secondary"
          />
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => onChange({ to: e.target.value })}
            aria-label={t("শেষ তারিখ", "End date")}
            className="rounded-lg border border-border-strong bg-surface px-3 py-2 text-meta text-text-secondary"
          />
        </>
      ) : null}
    </div>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-4 rounded-2xl border border-border-default bg-surface p-5 shadow-e1", className)}>
      {children}
    </div>
  );
}

function CardHead({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-center">
      <div className="flex-1">
        <h3 className="text-base font-semibold text-text-primary">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-meta text-text-muted">{subtitle}</p> : null}
      </div>
    </div>
  );
}

function LegendRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("size-2.5 rounded-full", color)} />
      <span className="flex-1 text-meta text-text-secondary">{label}</span>
      <span className="text-meta font-semibold text-text-primary tnum">{value}</span>
    </div>
  );
}

const toneMap = {
  danger: "bg-danger-bg text-danger-fg",
  warning: "bg-warning-bg text-warning-fg",
  info: "bg-info-bg text-info-fg",
  success: "bg-success-bg text-success-fg",
  neutral: "bg-sunken text-text-secondary",
} as const;

function Alert({
  tone,
  icon: Icon,
  title,
  desc,
  cta,
  ctaTone,
  href,
}: {
  tone: keyof typeof toneMap;
  icon: LucideIcon;
  title: string;
  desc: string;
  cta: string;
  ctaTone?: "danger";
  href: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-sunken p-3">
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", toneMap[tone])}>
        <Icon size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-text-primary">{title}</p>
        <p className="truncate text-xs text-text-muted">{desc}</p>
      </div>
      <Link
        href={href}
        className={cn(
          "shrink-0 rounded-lg px-3 py-2 text-meta font-semibold",
          ctaTone === "danger"
            ? "bg-danger-solid text-white"
            : "border border-border-control bg-surface text-text-primary hover:bg-sunken",
        )}
      >
        {cta}
      </Link>
    </div>
  );
}

function QuickAction({ icon: Icon, title, desc, href }: { icon: LucideIcon; title: string; desc: string; href: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-xl bg-sunken py-2.5 pl-2.5 pr-3 text-left hover:brightness-95">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-subtle text-primary">
        <Icon size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-text-primary">{title}</p>
        <p className="truncate text-xs text-text-muted">{desc}</p>
      </div>
      <ChevronRight size={16} className="text-text-muted" />
    </Link>
  );
}

function Notice({
  tone,
  icon: Icon,
  title,
  time,
}: {
  tone: keyof typeof toneMap;
  icon: LucideIcon;
  title: string;
  time: string;
}) {
  return (
    <div className="flex gap-3 rounded-xl bg-sunken p-3.5">
      <span className={cn("grid size-8.5 shrink-0 place-items-center rounded-lg", toneMap[tone])}>
        <Icon size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-meta font-semibold text-text-primary">{title}</p>
        <p className="mt-0.5 text-xs text-text-muted">{time}</p>
      </div>
    </div>
  );
}
