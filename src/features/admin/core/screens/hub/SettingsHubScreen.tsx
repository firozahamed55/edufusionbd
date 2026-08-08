"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, Award, BookOpen, CalendarDays, Check, GraduationCap, History,
  Layers, PenLine, Search, Settings2, ShieldCheck, Building2, Users, CalendarRange,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { PageHeader, Skeleton, ErrorState, NoAccessState, Badge } from "@/shared/ui";
import { useErrorMessage, classifyError } from "@/shared/services/errors";
import { useMyPermissions, useSettingsStatus } from "../../logic/hooks";
import { canSeeTab, ADMIN_SETTINGS_MODULE } from "@/features/admin/components/adminNav";
import type { SettingsStatus } from "../../logic/api";

/**
 * Settings hub — the module's front door (audit M-6).
 *
 * `/admin/core` used to 404. The rail pointed straight at `basic-config`, so
 * the first thing an administrator saw when they clicked "Settings" was a form,
 * and eleven unfamiliar labels sat in one flat strip with no descriptions, no
 * status and no search — even though `adminNav.ts` had carried the
 * Institution / Subjects / Users grouping all along and nothing surfaced it.
 *
 * The status chip is the point, not the decoration. Two of this module's worst
 * findings are invisible states: `signature = 0` means every certificate the
 * product prints is unsigned, and an empty `academic_calendar` means attendance
 * is takeable on Eid and the 30-day averages are diluted by holidays. Neither
 * was discoverable anywhere except by the failure it eventually caused. A card
 * that says "⚠ no signature set" turns both into something an operator can see
 * on the way past.
 */

/**
 * What "the institution's identity is set up" means — used by BOTH the card
 * chip and the checklist step, so the hub cannot say "3 fields missing" beside
 * a green tick for the same thing.
 *
 * `head_teacher` is deliberately not in it. A school between head teachers is a
 * normal state and nothing downstream breaks; the other four print on every
 * certificate, and a missing logo is a blank marksheet header.
 */
const IDENTITY_REQUIRED = ["name", "eiin", "address", "logo"] as const;
const identityMissing = (s: SettingsStatus) => IDENTITY_REQUIRED.filter((k) => !s.identity[k]).length;

type Area = {
  href: string;
  icon: LucideIcon;
  bn: string;
  en: string;
  descBn: string;
  descEn: string;
  group: "institution" | "academic" | "access";
  /**
   * The chip. `warn` renders in the caution tone. Optional: a card whose area
   * has no number worth stating is better with nothing than with a placeholder.
   */
  chip?: (s: SettingsStatus, t: (bn: string, en: string) => string, n: (v: string | number) => string) =>
    { label: string; warn?: boolean } | null;
  /** Words the search box matches beyond the title — the settings inside. */
  keywords: string[];
};

const AREAS: Area[] = [
  {
    href: "/admin/core/startup", icon: Building2, bn: "প্রতিষ্ঠানের পরিচিতি", en: "Institution Identity",
    descBn: "নাম, EIIN, বোর্ড, ঠিকানা ও লোগো — যা প্রতিটি সার্টিফিকেটে ছাপা হয়",
    descEn: "Name, EIIN, board, address and logo — what prints on every certificate",
    group: "institution",
    chip: (s, t, n) => {
      const missing = identityMissing(s);
      return missing > 0
        ? { label: t(`${n(missing)}টি তথ্য বাকি`, `${missing} field${missing === 1 ? "" : "s"} missing`), warn: true }
        : { label: t("সম্পূর্ণ", "Complete") };
    },
    keywords: ["eiin", "board", "logo", "mpo", "address", "head teacher", "website", "phone", "email", "founding year"],
  },
  {
    href: "/admin/core/basic-config", icon: Settings2, bn: "বেসিক কনফিগারেশন", en: "Basic Configuration",
    descBn: "শিক্ষাবর্ষ, কার্যদিবস, পিরিয়ড, পাস মার্ক ও ফিচার",
    descEn: "Academic year, working days, periods, pass mark and features",
    group: "institution",
    keywords: ["academic year", "session start", "week start", "working days", "weekend", "daily periods", "period duration", "pass mark", "attendance type", "language", "number system", "edusathi", "sms", "online fee payment", "grading system"],
  },
  {
    href: "/admin/core/class", icon: GraduationCap, bn: "শ্রেণি ও শাখা", en: "Classes & Sections",
    descBn: "শ্রেণি, শাখা, ধারণক্ষমতা ও শ্রেণিশিক্ষক",
    descEn: "Classes, sections, capacity and class teachers",
    group: "institution",
    chip: (s, t, n) =>
      s.classes === 0
        ? { label: t("কোনো শ্রেণি নেই", "No classes yet"), warn: true }
        : { label: t(`${n(s.classes)}টি শ্রেণি · ${n(s.sections)}টি শাখা`, `${n(s.classes)} classes · ${n(s.sections)} sections`) },
    keywords: ["class", "section", "capacity", "numeric level", "class teacher"],
  },
  {
    href: "/admin/core/calendar", icon: CalendarDays, bn: "শিক্ষাপঞ্জি", en: "Academic Calendar",
    descBn: "ছুটি, কর্মদিবস ও টার্ম — উপস্থিতির সব হিসাব এটি মেনে চলে",
    descEn: "Holidays, working days and terms — every attendance figure follows it",
    group: "institution",
    chip: (s, t, n) =>
      s.calendar_days === 0
        ? { label: t("ছুটি নির্ধারিত নয়", "No holidays set"), warn: true }
        : { label: t(`${n(s.calendar_days)} দিন ছুটি · ${n(s.terms)}টি টার্ম`, `${n(s.calendar_days)} holidays · ${n(s.terms)} terms`) },
    keywords: ["holiday", "eid", "term", "working day", "vacation", "weekend"],
  },
  {
    href: "/admin/core/academic-year", icon: CalendarRange, bn: "শিক্ষাবর্ষ", en: "Academic Year",
    descBn: "নতুন বর্ষ তৈরি, চলতি বর্ষ নির্ধারণ ও পুরোনো বর্ষ বন্ধ",
    descEn: "Create a year, choose the current one, close a finished one",
    group: "institution",
    keywords: ["year", "session", "rollover", "archive", "current year"],
  },
  {
    href: "/admin/core/signature", icon: PenLine, bn: "অনুমোদিত স্বাক্ষর", en: "Approved Signatures",
    descBn: "মার্কশিট ও সার্টিফিকেটে ছাপা স্বাক্ষর",
    descEn: "The signatures printed on marksheets and certificates",
    group: "institution",
    chip: (s, t, n) =>
      s.signatures === 0
        ? { label: t("কোনো স্বাক্ষর নেই", "No signature set"), warn: true }
        : { label: t(`${n(s.signatures)}টি স্বাক্ষর`, `${n(s.signatures)} signatures`) },
    keywords: ["signature", "head teacher", "exam controller", "accountant", "certificate"],
  },

  {
    href: "/admin/core/subject", icon: BookOpen, bn: "বিষয় তালিকা", en: "Subject List",
    descBn: "বিষয়, পূর্ণমান, পাস নম্বর ও প্রযোজ্য শ্রেণি",
    descEn: "Subjects, full marks, pass marks and applicable classes",
    group: "academic",
    chip: (s, t, n) =>
      s.subjects === 0
        ? { label: t("কোনো বিষয় নেই", "No subjects yet"), warn: true }
        : { label: t(`${n(s.subjects)}টি বিষয়`, `${n(s.subjects)} subjects`) },
    keywords: ["subject", "full marks", "pass marks", "compulsory", "optional", "code"],
  },
  {
    href: "/admin/core/subject-group", icon: Layers, bn: "বিষয় গ্রুপ", en: "Subject Groups",
    descBn: "বিভাগভিত্তিক গ্রুপ ও ঐচ্ছিক বিষয়",
    descEn: "Department groups and elective subjects",
    group: "academic",
    chip: (s, t, n) => ({ label: t(`${n(s.subject_groups)}টি গ্রুপ`, `${n(s.subject_groups)} groups`) }),
    keywords: ["group", "science", "commerce", "arts", "elective"],
  },
  {
    href: "/admin/core/grading", icon: Award, bn: "গ্রেডিং স্কিম", en: "Grading Scheme",
    descBn: "গ্রেড, নম্বর সীমা ও গ্রেড পয়েন্ট",
    descEn: "Grades, mark ranges and grade points",
    group: "academic",
    chip: (s, t, n) =>
      s.grade_schemes === 0
        ? { label: t("কোনো স্কিম নেই", "No scheme yet"), warn: true }
        : { label: t(`${n(s.grade_schemes)}টি স্কিম`, `${n(s.grade_schemes)} schemes`) },
    keywords: ["grade", "gpa", "grade point", "mark range", "a+", "scheme"],
  },

  {
    href: "/admin/core/user-list", icon: Users, bn: "ইউজার ও ভূমিকা", en: "Users & Roles",
    descBn: "অ্যাকাউন্ট, ভূমিকা, আমন্ত্রণ ও সাসপেনশন",
    descEn: "Accounts, roles, invitations and suspension",
    group: "access",
    chip: (s, t, n) =>
      s.users <= 1
        ? { label: t("একটিই অ্যাকাউন্ট", "Only one account"), warn: true }
        : { label: t(`${n(s.users)} জন ব্যবহারকারী`, `${n(s.users)} users`) },
    keywords: ["user", "invite", "role", "suspend", "password reset", "mfa", "session"],
  },
  {
    href: "/admin/core/permissions", icon: ShieldCheck, bn: "অনুমতি ম্যাট্রিক্স", en: "Permission Matrix",
    descBn: "কোন ভূমিকা কী করতে পারে",
    descEn: "What each role is allowed to do",
    group: "access",
    chip: (s, t, n) => ({ label: t(`${n(s.roles)}টি ভূমিকা`, `${n(s.roles)} roles`) }),
    keywords: ["permission", "role", "capability", "access"],
  },
  {
    href: "/admin/core/audit-log", icon: History, bn: "পরিবর্তনের ইতিহাস", en: "Audit Log",
    descBn: "কে কখন কী বদলেছে",
    descEn: "Who changed what, and when",
    group: "access",
    chip: (s, t, n) => ({ label: t(`৩০ দিনে ${n(s.audit_events_30d)}টি`, `${n(s.audit_events_30d)} in 30 days`) }),
    keywords: ["audit", "history", "change", "who changed"],
  },
];

const GROUPS = [
  { key: "institution" as const, bn: "প্রতিষ্ঠান", en: "Institution" },
  { key: "academic" as const, bn: "একাডেমিক", en: "Academic" },
  { key: "access" as const, bn: "প্রবেশাধিকার ও নিয়ন্ত্রণ", en: "Access & Governance" },
];

/**
 * The seven steps a fresh institution has to complete, in the order they
 * actually depend on each other — subjects before grading, classes before
 * sections, everything before users. Percentage complete, so an operator who
 * comes back in a week knows where they stopped.
 */
function checklist(s: SettingsStatus) {
  return [
    { key: "identity", done: identityMissing(s) === 0, href: "/admin/core/startup", bn: "প্রতিষ্ঠানের পরিচিতি", en: "Institution identity" },
    { key: "classes", done: s.classes > 0, href: "/admin/core/class", bn: "শ্রেণি ও শাখা", en: "Classes and sections" },
    { key: "subjects", done: s.subjects > 0, href: "/admin/core/subject", bn: "বিষয় তালিকা", en: "Subjects" },
    { key: "grading", done: s.grade_schemes > 0, href: "/admin/core/grading", bn: "গ্রেডিং স্কিম", en: "Grading scheme" },
    { key: "calendar", done: s.calendar_days > 0, href: "/admin/core/calendar", bn: "শিক্ষাপঞ্জি ও ছুটি", en: "Calendar and holidays" },
    { key: "signatures", done: s.signatures > 0, href: "/admin/core/signature", bn: "অনুমোদিত স্বাক্ষর", en: "Approved signatures" },
    { key: "users", done: s.users > 1, href: "/admin/core/user-list", bn: "প্রকৃত ব্যবহারকারী অ্যাকাউন্ট", en: "Real user accounts" },
  ];
}

export function SettingsHubScreen() {
  const { t, n, isBn } = useT();
  const msg = useErrorMessage();
  const status = useSettingsStatus();
  const { data: permissions } = useMyPermissions();
  const [q, setQ] = useState("");

  /** Same permission filter the tab strip uses, so the hub cannot offer a card
   *  the caller would land on an empty screen from (audit M-4). */
  const visible = useMemo(
    () => AREAS.filter((a) => {
      const tab = ADMIN_SETTINGS_MODULE.tabs?.find((x) => x.href === a.href);
      return !tab || canSeeTab(ADMIN_SETTINGS_MODULE, tab, permissions);
    }),
    [permissions],
  );

  const matches = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return visible;
    return visible.filter((a) =>
      a.bn.includes(q.trim()) ||
      a.en.toLowerCase().includes(term) ||
      a.descEn.toLowerCase().includes(term) ||
      a.keywords.some((k) => k.includes(term)),
    );
  }, [visible, q]);

  if (status.isError) {
    return classifyError(status.error) === "forbidden" ? (
      <NoAccessState
        title={t("সেটিংস দেখার অনুমতি নেই", "You do not have access to Settings")}
        description={t("প্রতিষ্ঠানের অ্যাডমিনকে জানান।", "Ask your institution's administrator.")}
        permission="core.settings"
      />
    ) : (
      <ErrorState title={t("সেটিংস লোড করা যায়নি", "Could not load Settings")} description={msg(status.error)} />
    );
  }

  const s = status.data;
  const steps = s ? checklist(s) : [];
  const doneCount = steps.filter((x) => x.done).length;
  const percent = steps.length ? Math.round((doneCount / steps.length) * 100) : 0;

  return (
    <div className="flex flex-col gap-5 pb-6">
      <PageHeader
        crumbs={[{ label: t("সেটিংস", "Settings") }]}
        title={t("সেটিংস", "Settings")}
        subtitle={t(
          "প্রতিষ্ঠান কীভাবে চলবে তা এখানে নির্ধারিত হয় — এই মানগুলো ফলাফল, সার্টিফিকেট ও ফি হিসাবের ভিত্তি",
          "How the institution runs is decided here — these values are the input to results, certificates and fee schedules",
        )}
      />

      {/* Only while it matters. A school three years in does not need to be
          told it finished setting up. */}
      {s && percent < 100 ? (
        <section className="flex flex-col gap-3 rounded-2xl border border-border-default bg-surface p-4.5 shadow-e1">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-label font-semibold text-text-primary">{t("প্রাথমিক সেটআপ", "Setup checklist")}</h2>
              <p className="text-micro text-text-muted">
                {t(
                  `${n(doneCount)}/${n(steps.length)} ধাপ সম্পন্ন — বাকিগুলো শেষ না হলে ফলাফল ও সার্টিফিকেট অসম্পূর্ণ থাকবে`,
                  `${doneCount} of ${steps.length} done — results and certificates stay incomplete until the rest are`,
                )}
              </p>
            </div>
            <span className="text-h4 font-bold tabular-nums text-primary">{n(percent)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-sunken" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={t("সেটআপ অগ্রগতি", "Setup progress")}>
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
          </div>
          <ul className="flex flex-wrap gap-2">
            {steps.map((step) => (
              <li key={step.key}>
                <Link
                  href={step.href}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-meta font-medium transition-colors",
                    step.done
                      ? "border-border-default bg-sunken text-text-muted"
                      : "border-primary/40 bg-primary-subtle text-primary hover:border-primary",
                  )}
                >
                  {step.done ? <Check size={13} aria-hidden /> : <span aria-hidden className="size-1.5 rounded-full bg-primary" />}
                  {t(step.bn, step.en)}
                  <span className="sr-only">{step.done ? t("— সম্পন্ন", "— done") : t("— বাকি", "— not done")}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="relative w-90 max-w-full">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label={t("সেটিংস খুঁজুন", "Search settings")}
          placeholder={t("সেটিংস খুঁজুন — যেমন “পাস মার্ক”", "Search settings — try “pass mark”")}
          className="h-10.5 w-full rounded-lg border border-border-strong bg-surface pl-9 pr-3 text-meta text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none"
        />
      </div>

      {status.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : matches.length === 0 ? (
        <p className="rounded-2xl border border-border-default bg-surface px-5 py-8 text-center text-meta text-text-muted">
          {t(`“${q}” এর সাথে কিছু মেলেনি`, `Nothing matched “${q}”`)}
        </p>
      ) : (
        GROUPS.map((g) => {
          const items = matches.filter((a) => a.group === g.key);
          if (items.length === 0) return null;
          return (
            <section key={g.key} className="flex flex-col gap-3">
              <h2 className="text-micro font-semibold uppercase tracking-wide text-text-decorative">{t(g.bn, g.en)}</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((a) => {
                  const chip = s && a.chip ? a.chip(s, t, n) : null;
                  const Icon = a.icon;
                  return (
                    <Link
                      key={a.href}
                      href={a.href}
                      className="group flex flex-col gap-2 rounded-2xl border border-border-default bg-surface p-4 shadow-e1 transition-colors hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-subtle text-primary">
                          <Icon size={17} aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-body font-semibold text-text-primary group-hover:text-primary">
                          {isBn ? a.bn : a.en}
                        </span>
                      </div>
                      <p className="text-meta leading-snug text-text-secondary">{isBn ? a.descBn : a.descEn}</p>
                      {chip ? (
                        <span className="mt-auto flex items-center gap-1.5">
                          {chip.warn ? (
                            <Badge tone="warning">
                              <AlertTriangle size={12} aria-hidden /> {chip.label}
                            </Badge>
                          ) : (
                            <span className="text-micro text-text-muted">{chip.label}</span>
                          )}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
