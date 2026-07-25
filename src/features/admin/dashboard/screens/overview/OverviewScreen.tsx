"use client";

import {
  Users,
  UserCheck,
  Wallet,
  TrendingUp,
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
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { BarChart, Donut, Skeleton, ErrorState } from "@/shared/ui";
import { useDashboard } from "./logic/useDashboard";

/**
 * Admin dashboard overview — collected from Figma (Light 6:2 / Dark 51:2).
 * Content-only: the sidebar/topbar come from AdminShell. Every color is a
 * semantic token, so this single component is correct in light AND dark.
 * Fully localized via useT() — bn/en switch together with the nav (no more
 * English-nav + Bengali-body mismatch). Charts use the accessible primitives.
 */

export function OverviewScreen() {
  const { t, n } = useT();
  const { data, isLoading, isError, refetch } = useDashboard();

  const bdt = (v: number) => `৳${n(new Intl.NumberFormat("en-IN").format(Math.round(v)))}`;
  const collected = data?.collectedThisMonth ?? 0;
  const due = data?.totalDue ?? 0;
  const collectRate =
    collected + due > 0 ? Math.round((collected / (collected + due)) * 100) : 0;

  const attendance = [
    { bn: "রবি", en: "Sun", value: 90 },
    { bn: "সোম", en: "Mon", value: 86 },
    { bn: "মঙ্গল", en: "Tue", value: 92 },
    { bn: "বুধ", en: "Wed", value: 89 },
    { bn: "বৃহ", en: "Thu", value: 93 },
  ].map((d) => ({ label: t(d.bn, d.en), value: d.value, display: n(d.value) }));

  const quickActions = [
    { icon: UserPlus, title: t("নতুন শিক্ষার্থী", "New Student"), desc: t("নতুন রেজিস্ট্রেশন", "New registration") },
    { icon: CalendarCheck, title: t("উপস্থিতি নিন", "Take Attendance"), desc: t("দৈনিক উপস্থিতি", "Daily attendance") },
    { icon: CreditCard, title: t("ফি সংগ্রহ", "Collect Fees"), desc: t("পেমেন্ট কালেকশন", "Payment collection") },
    { icon: PenSquare, title: t("মার্কস এন্ট্রি", "Marks Entry"), desc: t("পরীক্ষার ফলাফল", "Exam results") },
    { icon: Send, title: t("SMS পাঠান", "Send SMS"), desc: t("বাল্ক মেসেজিং", "Bulk messaging") },
  ];

  if (isLoading) {
    return (
      <div className="mx-auto grid max-w-300 grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-[18px]" />
        ))}
      </div>
    );
  }
  if (isError) {
    return (
      <div className="mx-auto max-w-300">
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
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-300 flex-col gap-7">
      {/* Greeting + actions */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1">
          <h1 className="text-h3 font-bold text-text-primary">
            {t("সুপ্রভাত, নুসরাত", "Good morning, Nusrat")}
          </h1>
          <p className="mt-1.5 text-sm text-text-secondary">
            {t("এক নজরে আপনার স্কুলের সাপ্তাহিক চিত্র দেখে নিন", "Your school's week at a glance")}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button className="rounded-lg border border-border-strong bg-surface px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-sunken">
            {t("প্রতিবেদন", "Report")}
          </button>
          <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-text-on-primary hover:bg-primary-hover">
            <Plus size={16} /> {t("নতুন শিক্ষার্থী", "New Student")}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Kpi grad="grad-indigo" shadow="shadow-[0px_6px_16px_-4px_rgba(79,70,229,0.26)]" icon={Users} label={t("মোট শিক্ষার্থী", "Total Students")} value={n(data?.activeStudents ?? 0)} delta={n(data?.classSections ?? 0)} period={t("শ্রেণি-শাখা", "class-sections")} />
        <Kpi grad="grad-emerald" shadow="shadow-[0px_6px_16px_-4px_rgba(5,150,105,0.26)]" icon={UserCheck} label={t("মোট শিক্ষক", "Total Teachers")} value={n(data?.activeTeachers ?? 0)} delta={n(data?.activeStudents ?? 0)} period={t("শিক্ষার্থী", "students")} />
        <Kpi grad="grad-sky" shadow="shadow-[0px_6px_16px_-4px_rgba(2,132,199,0.26)]" icon={Wallet} label={t("এ মাসে আদায়", "Collected (month)")} value={bdt(collected)} delta={bdt(due)} period={t("বকেয়া", "due")} />
      </div>

      {/* Analytics */}
      <SectionHeader
        title={t("পরিসংখ্যান ও বিশ্লেষণ", "Statistics & Analytics")}
        subtitle={t("উপস্থিতি ও ফি আদায়ের সাপ্তাহিক চিত্র", "Weekly attendance and fee collection")}
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_400px]">
        <Card>
          <CardHead
            title={t("সাপ্তাহিক উপস্থিতির হার", "Weekly Attendance Rate")}
            subtitle={t("গড় ৯১% · গত সপ্তাহের চেয়ে ১.৮% বেশি", "Avg 91% · 1.8% higher than last week")}
            pill={t("চলতি সপ্তাহ", "This week")}
          />
          <div className="mt-4">
            <BarChart data={attendance} unit="%" max={100} caption={t("সাপ্তাহিক উপস্থিতির হার", "Weekly attendance rate")} />
          </div>
        </Card>

        <Card>
          <CardHead title={t("ফি আদায়", "Fee Collection")} pill={t("এই সপ্তাহ", "This week")} />
          <div className="flex items-center justify-center py-2">
            <Donut percent={collectRate} valueLabel={`${n(collectRate)}%`} label={t("আদায় হয়েছে", "collected")} caption={t("ফি আদায়ের হার", "Fee collection rate")} />
          </div>
          <div className="flex flex-col gap-2.5">
            <LegendRow color="bg-primary" label={t("আদায়", "Collected")} value={bdt(collected)} />
            <LegendRow color="bg-border-strong" label={t("বকেয়া", "Due")} value={bdt(due)} />
          </div>
        </Card>
      </div>

      {/* Priorities + quick actions */}
      <SectionHeader
        title={t("করণীয় ও দ্রুত অ্যাকশন", "To-dos & Quick Actions")}
        subtitle={t("যেসব বিষয়ে এখন নজর দেওয়া প্রয়োজন", "What needs your attention right now")}
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_400px]">
        <Card className="gap-3">
          <div className="flex items-center">
            <h3 className="flex-1 text-base font-semibold text-text-primary">{t("অগ্রাধিকার ও সতর্কতা", "Priorities & Alerts")}</h3>
            <button className="text-meta font-medium text-primary">{t("সব দেখুন", "View all")}</button>
          </div>
          <Alert
            tone="danger"
            icon={AlertTriangle}
            title={t("৳১,১২,০০০ ফি বকেয়া · ৪২ জন", "৳1,12,000 fees due · 42 students")}
            desc={t("শেষ তারিখ পেরিয়েছে ৩ দিন আগে", "Due date passed 3 days ago")}
            cta={t("তাগাদা পাঠান", "Send Reminder")}
            ctaTone="danger"
          />
          <Alert
            tone="warning"
            icon={ShieldAlert}
            title={t("৩ জন শিক্ষার্থী ঝুঁকিতে", "3 students at risk")}
            desc={t("উপস্থিতি ৬২% এর নিচে নেমেছে", "Attendance dropped below 62%")}
            cta={t("দেখুন", "View")}
          />
          <Alert
            tone="info"
            icon={ClipboardCheck}
            title={t("অর্ধবার্ষিক ফলাফল অনুমোদনের অপেক্ষায়", "Half-yearly results awaiting approval")}
            desc={t("৮ম শ্রেণি · প্রকাশের আগে লক করুন", "Class 8 · Lock before publishing")}
            cta={t("অনুমোদন", "Approve")}
          />
        </Card>

        <Card className="gap-2">
          <div className="flex items-center gap-2.5 pb-1">
            <span className="grid size-8 place-items-center rounded-lg bg-primary-subtle text-primary">
              <TrendingUp size={18} />
            </span>
            <h3 className="flex-1 text-base font-semibold text-text-primary">{t("দ্রুত অ্যাকশন", "Quick Actions")}</h3>
            <span className="rounded-full bg-primary-subtle px-2.5 py-1 text-[11.5px] font-semibold text-primary">
              {t("৫ শর্টকাট", "5 shortcuts")}
            </span>
          </div>
          {quickActions.map((a) => (
            <QuickAction key={a.title} {...a} />
          ))}
        </Card>
      </div>

      {/* Notices */}
      <Card className="gap-1">
        <div className="flex items-center pb-1.5">
          <h3 className="flex-1 text-base font-semibold text-text-primary">{t("সাম্প্রতিক নোটিশ", "Recent Notices")}</h3>
          <button className="text-meta font-medium text-primary">{t("+ নতুন", "+ New")}</button>
        </div>
        <div className="grid grid-cols-1 gap-3.5 pt-1.5 md:grid-cols-3">
          {(data?.notices ?? []).length === 0 ? (
            <p className="col-span-full py-4 text-sm text-text-muted">
              {t("কোনো নোটিশ নেই", "No notices yet")}
            </p>
          ) : (
            (data?.notices ?? []).map((no) => (
              <Notice
                key={no.id}
                tone={no.status === "urgent" ? "warning" : no.status === "published" ? "info" : "success"}
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
  shadow,
  icon: Icon,
  label,
  value,
  delta,
  period,
}: {
  grad: string;
  shadow: string;
  icon: LucideIcon;
  label: string;
  value: string;
  delta: string;
  period: string;
}) {
  return (
    <div className={cn("relative flex flex-col gap-3.5 overflow-hidden rounded-[18px] px-5 py-4.5 text-white", grad, shadow)}>
      <div className="flex items-center">
        <p className="flex-1 text-meta font-medium">{label}</p>
        <span className="grid size-9 place-items-center rounded-[10px] bg-white/20">
          <Icon size={20} />
        </span>
      </div>
      <p className="text-3xl font-bold tnum">{value}</p>
      <div className="flex items-center gap-1.5 text-meta">
        <TrendingUp size={13} />
        <span className="font-semibold">{delta}</span>
        <span className="opacity-90">{period}</span>
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col gap-0.5 pt-1">
      <h2 className="text-label font-semibold text-text-primary">{title}</h2>
      <p className="text-meta text-text-muted">{subtitle}</p>
    </div>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-4 rounded-2xl bg-surface p-5 shadow-e3", className)}>
      {children}
    </div>
  );
}

function CardHead({ title, subtitle, pill }: { title: string; subtitle?: string; pill: string }) {
  return (
    <div className="flex items-center">
      <div className="flex-1">
        <h3 className="text-base font-semibold text-text-primary">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-meta text-text-muted">{subtitle}</p> : null}
      </div>
      <span className="rounded-full border border-border-default bg-sunken px-3 py-1.5 text-xs font-medium text-text-secondary">
        {pill}
      </span>
    </div>
  );
}

function LegendRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("size-2.5 rounded-full", color)} />
      <span className="flex-1 text-meta text-text-secondary">{label}</span>
      <span className="text-meta font-semibold text-text-primary">{value}</span>
    </div>
  );
}

const toneMap = {
  danger: "bg-danger-bg text-danger-fg",
  warning: "bg-warning-bg text-warning-fg",
  info: "bg-info-bg text-info-fg",
  success: "bg-success-bg text-success-fg",
} as const;

function Alert({
  tone,
  icon: Icon,
  title,
  desc,
  cta,
  ctaTone,
}: {
  tone: keyof typeof toneMap;
  icon: LucideIcon;
  title: string;
  desc: string;
  cta: string;
  ctaTone?: "danger";
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-sunken p-3">
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-[10px]", toneMap[tone])}>
        <Icon size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-text-primary">{title}</p>
        <p className="truncate text-xs text-text-muted">{desc}</p>
      </div>
      <button
        className={cn(
          "shrink-0 rounded-lg px-3 py-2 text-meta font-semibold",
          ctaTone === "danger"
            ? "bg-danger-fg text-white"
            : "border border-border-strong bg-surface text-text-primary hover:bg-sunken",
        )}
      >
        {cta}
      </button>
    </div>
  );
}

function QuickAction({ icon: Icon, title, desc }: { icon: LucideIcon; title: string; desc: string }) {
  return (
    <button className="flex items-center gap-3 rounded-xl bg-sunken py-2.5 pl-2.5 pr-3 text-left hover:brightness-95">
      <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-primary-subtle text-primary">
        <Icon size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-text-primary">{title}</p>
        <p className="truncate text-xs text-text-muted">{desc}</p>
      </div>
      <ChevronRight size={16} className="text-text-muted" />
    </button>
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
      <span className={cn("grid size-8.5 shrink-0 place-items-center rounded-[9px]", toneMap[tone])}>
        <Icon size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-meta font-semibold text-text-primary">{title}</p>
        <p className="mt-0.5 text-xs text-text-muted">{time}</p>
      </div>
    </div>
  );
}
