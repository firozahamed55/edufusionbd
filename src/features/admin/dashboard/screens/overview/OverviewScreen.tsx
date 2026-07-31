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
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { BarChart, Donut, Skeleton, ErrorState, EmptyState, PageHeader } from "@/shared/ui";
import { useAdminUser } from "@/features/admin/components/useAdminUser";
import { SetupChecklist } from "../../components/SetupChecklist";
import { localDay, weekdayShort } from "@/shared/lib/format";
import { useDashboard } from "./logic/useDashboard";
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

const ATTENTION_META: Record<
  string,
  { icon: LucideIcon; cta: { bn: string; en: string } }
> = {
  overdue_fees: { icon: AlertTriangle, cta: { bn: "তাগাদা পাঠান", en: "Send reminders" } },
  attendance_low: { icon: ShieldAlert, cta: { bn: "তালিকা দেখুন", en: "View list" } },
  results_pending: { icon: ClipboardCheck, cta: { bn: "পর্যালোচনা", en: "Review" } },
};

export function OverviewScreen() {
  const { t, n } = useT();
  const { data: me } = useAdminUser();
  const { data, isLoading, isError, refetch } = useDashboard();

  const bdt = (v: number) => `৳${n(new Intl.NumberFormat("en-IN").format(Math.round(v)))}`;
  const collected = data?.collectedThisMonth ?? 0;
  const due = data?.totalDue ?? 0;
  const collectRate = collected + due > 0 ? Math.round((collected / (collected + due)) * 100) : 0;

  // Real time-of-day, not a hardcoded "Good morning".
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? t("সুপ্রভাত", "Good morning") : hour < 17 ? t("শুভ অপরাহ্ন", "Good afternoon") : t("শুভ সন্ধ্যা", "Good evening");

  const trend = data?.attendanceTrend ?? [];
  const avgRate = trend.length > 0 ? Math.round(trend.reduce((s, p) => s + p.rate, 0) / trend.length) : 0;
  // Last 7 points, labelled by weekday — the chart is a real 30-day rolling
  // series now, not five invented numbers.
  const chartData = trend.slice(-7).map((p) => ({
    label: weekdayShort(`${p.date}T12:00:00Z`),
    value: p.rate,
    display: n(p.rate),
  }));

  const quickActions = [
    { icon: UserPlus, title: t("নতুন শিক্ষার্থী", "New Student"), desc: t("নতুন রেজিস্ট্রেশন", "New registration"), href: "/admin/student/registration" },
    { icon: CalendarCheck, title: t("উপস্থিতি নিন", "Take Attendance"), desc: t("দৈনিক উপস্থিতি", "Daily attendance"), href: "/admin/attendance/section" },
    { icon: CreditCard, title: t("ফি সংগ্রহ", "Collect Fees"), desc: t("পেমেন্ট কালেকশন", "Payment collection"), href: "/admin/fee/quick-collection-list" },
    { icon: PenSquare, title: t("মার্কস এন্ট্রি", "Marks Entry"), desc: t("পরীক্ষার ফলাফল", "Exam results"), href: "/admin/exam/mark-input" },
    { icon: Send, title: t("SMS পাঠান", "Send SMS"), desc: t("বাল্ক মেসেজিং", "Bulk messaging"), href: "/admin/sms-notice/send" },
  ];

  const studentsPerTeacher = data?.activeTeachers
    ? Math.round((data.activeStudents ?? 0) / data.activeTeachers)
    : 0;

  // Zero students AND zero sections = nothing has been set up, which is a
  // different state from "zero results for your filter" (B-8).
  const isEmptyInstitution = (data?.activeStudents ?? 0) === 0 && (data?.classSections ?? 0) === 0;

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
        <div className="flex items-center gap-2.5">
          <Link href="/admin/student/reports-summary" className="rounded-lg border border-border-control bg-surface px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-sunken">
            {t("প্রতিবেদন", "Report")}
          </Link>
          <Link href="/admin/student/registration" className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-text-on-primary hover:bg-primary-hover">
            <Plus size={16} /> {t("নতুন শিক্ষার্থী", "New Student")}
          </Link>
        </div>
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

      {/* Needs attention — every row from a live query with a real CTA */}
      <Card className="gap-3">
        <div className="flex items-center gap-2">
          <h2 className="flex-1 text-base font-semibold text-text-primary">
            {t("এখন নজর দিন", "Needs attention")}
            {(data?.attention.length ?? 0) > 0 ? (
              <span className="ml-2 rounded-full bg-danger-bg px-2 py-0.5 text-micro font-semibold text-danger-fg tnum">
                {n(data?.attention.length ?? 0)}
              </span>
            ) : null}
          </h2>
        </div>
        {(data?.attention.length ?? 0) === 0 ? (
          <p className="py-3 text-sm text-text-muted">
            {t("এই মুহূর্তে কিছু করণীয় নেই।", "Nothing needs your attention right now.")}
          </p>
        ) : (
          data?.attention.map((a) => {
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

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Kpi grad="grad-indigo" icon={Users} label={t("মোট শিক্ষার্থী", "Total Students")} value={n(data?.activeStudents ?? 0)} delta={n(data?.classSections ?? 0)} period={t("শ্রেণি-শাখা", "class-sections")} />
        <Kpi grad="grad-emerald" icon={UserCheck} label={t("মোট শিক্ষক", "Total Teachers")} value={n(data?.activeTeachers ?? 0)} delta={n(studentsPerTeacher)} period={t("শিক্ষার্থী/শিক্ষক", "students/teacher")} />
        <Kpi grad="grad-sky" icon={Wallet} label={t("এ মাসে আদায়", "Collected (month)")} value={bdt(collected)} delta={bdt(due)} period={t("বকেয়া", "due")} />
      </div>

      {/* Analytics */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_400px]">
        <Card>
          <CardHead
            title={t("উপস্থিতির হার", "Attendance Rate")}
            subtitle={
              trend.length > 0
                ? t(`গত ৩০ দিনের গড় ${n(avgRate)}%`, `${avgRate}% average over the last 30 days`)
                : t("এখনো কোনো উপস্থিতি রেকর্ড নেই", "No attendance recorded yet")
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
            data?.activity.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-xl bg-sunken px-3 py-2.5">
                <span className="min-w-0 flex-1 truncate text-meta text-text-primary">
                  <b className="font-semibold">{a.action}</b> · {a.entity}
                </span>
                <span className="shrink-0 text-xs text-text-muted tnum">
                  {n(localDay(a.at))}
                </span>
              </div>
            ))
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
}: {
  grad: string;
  icon: LucideIcon;
  label: string;
  value: string;
  delta: string;
  period: string;
}) {
  return (
    <div className={cn("relative flex flex-col gap-3.5 overflow-hidden rounded-2xl px-5 py-4.5 text-white shadow-e2", grad)}>
      <div className="flex items-center">
        <p className="flex-1 text-meta font-medium">{label}</p>
        <span className="grid size-9 place-items-center rounded-lg bg-white/20">
          <Icon size={20} />
        </span>
      </div>
      <p className="text-3xl font-bold tnum">{value}</p>
      {/* No trend arrow: this is a secondary metric, not a period-over-period
          change, and rendering an up-arrow beside it was actively misleading
          (audit D-3). */}
      <div className="flex items-center gap-1.5 text-meta">
        <span className="font-semibold">{delta}</span>
        <span className="opacity-90">{period}</span>
      </div>
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
