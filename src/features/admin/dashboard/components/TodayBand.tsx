"use client";

import Link from "next/link";
import { CalendarCheck, CheckCircle2, ChevronRight, MessageSquare, UserX, Wallet } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { Skeleton } from "@/shared/ui";
import type { TodayStats } from "../screens/overview/logic/api";

/**
 * TODAY (analysis II · D-10).
 *
 * The governing finding of the dashboard analysis was D-0: the screen was
 * organised by ENTITY — students, teachers, fees — when the job is organised by
 * TIME. Enrolment counts, which change a handful of times a year, sat at the
 * top at the same visual weight as figures that change hourly, and the four
 * things an administrator needs before 10 a.m. were not on the screen at all.
 *
 * This is that band, and it is deliberately first. Four facts, each a link to
 * the screen that acts on it:
 *
 *   • how many registers are in, and WHICH are not
 *   • present / absent right now
 *   • money taken today
 *   • SMS sent today
 *
 * A band with nothing in it is not rendered — see `hasNothing`. On a Friday, or
 * before the school opens, "0 of 9 registers · 0 present · ৳0 · 0 SMS" is four
 * zeroes presented as an operating picture, which is worse than no band.
 */
export function TodayBand({
  data,
  isLoading,
  canAttendance,
  canFee,
  canSms,
}: {
  data: TodayStats | undefined;
  isLoading: boolean;
  canAttendance: boolean;
  canFee: boolean;
  canSms: boolean;
}) {
  const { t, n, isBn } = useT();

  if (isLoading) return <Skeleton className="h-28 rounded-2xl" />;
  if (!data) return null;

  const { sectionsTaken, sectionsTotal, pendingSections, present, absent, collected, smsSent } = data;
  const allIn = sectionsTotal > 0 && pendingSections.length === 0;

  // Nothing has happened yet today AND there is nothing outstanding to chase.
  const hasNothing =
    sectionsTotal === 0 || (sectionsTaken === 0 && present === 0 && collected === 0 && smsSent === 0);
  if (hasNothing) return null;

  const bdt = (v: number) => `৳${n(new Intl.NumberFormat("en-IN").format(Math.round(v)))}`;

  return (
    <section
      aria-label={t("আজকের চিত্র", "Today")}
      className="flex flex-col gap-4 rounded-2xl border border-border-default bg-surface p-5 shadow-e1"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex-1 text-base font-semibold text-text-primary">{t("আজ", "Today")}</h2>
        <span className="text-meta text-text-muted tnum">{n(data.date)}</span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {canAttendance ? (
          <Tile
            href="/admin/attendance/section"
            icon={allIn ? CheckCircle2 : CalendarCheck}
            tone={allIn ? "success" : "warning"}
            label={t("উপস্থিতি নেওয়া হয়েছে", "Registers taken")}
            value={t(`${n(sectionsTaken)} / ${n(sectionsTotal)}`, `${sectionsTaken} / ${sectionsTotal}`)}
            note={
              allIn
                ? t("সব শাখার উপস্থিতি জমা হয়েছে", "Every section has submitted")
                : // Named, up to three. A bare "3 pending" sends the operator
                  // hunting; the names are the whole value of the checklist.
                  pendingSections
                    .slice(0, 3)
                    .map((s) => (isBn ? s.label_bn : s.label_en))
                    .join(", ") +
                  (pendingSections.length > 3
                    ? t(` + আরও ${n(pendingSections.length - 3)}`, ` + ${pendingSections.length - 3} more`)
                    : "")
            }
          />
        ) : null}

        {canAttendance ? (
          <Tile
            href="/admin/attendance/report"
            icon={UserX}
            tone={absent > 0 ? "danger" : "success"}
            label={t("আজ অনুপস্থিত", "Absent today")}
            value={n(absent)}
            note={t(`${n(present)} জন উপস্থিত`, `${present} present`)}
          />
        ) : null}

        {canFee ? (
          <Tile
            href="/admin/fee/day-book"
            icon={Wallet}
            tone="info"
            label={t("আজ আদায়", "Collected today")}
            value={bdt(collected)}
            note={t("দৈনিক হিসাবে দেখুন", "See the day book")}
          />
        ) : null}

        {canSms ? (
          <Tile
            href="/admin/sms-notice/history"
            icon={MessageSquare}
            tone="neutral"
            label={t("আজ এসএমএস", "SMS today")}
            value={n(smsSent)}
            note={t("প্রাপক সংখ্যা", "recipients")}
          />
        ) : null}
      </div>
    </section>
  );
}

const tones = {
  success: "bg-success-bg text-success-fg",
  warning: "bg-warning-bg text-warning-fg",
  danger: "bg-danger-bg text-danger-fg",
  info: "bg-info-bg text-info-fg",
  neutral: "bg-sunken text-text-secondary",
} as const;

function Tile({
  href,
  icon: Icon,
  tone,
  label,
  value,
  note,
}: {
  href: string;
  icon: React.ComponentType<{ size?: number }>;
  tone: keyof typeof tones;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-xl bg-sunken p-3.5 transition-colors hover:bg-primary-subtle"
    >
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", tones[tone])}>
        <Icon size={19} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-meta text-text-secondary">{label}</span>
        <span className="mt-0.5 block text-xl font-bold text-text-primary tnum">{value}</span>
        <span className="mt-0.5 block truncate text-xs text-text-muted" title={note}>
          {note}
        </span>
      </span>
      <ChevronRight size={16} className="mt-0.5 shrink-0 text-text-muted opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}
