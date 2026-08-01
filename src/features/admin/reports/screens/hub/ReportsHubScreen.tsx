"use client";

import Link from "next/link";
import {
  ArrowRight, BarChart3, CalendarCheck, GraduationCap, LifeBuoy, Users, Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { PageHeader } from "@/shared/ui";
import { useMyPermissions } from "@/features/admin/core/logic/hooks";

/**
 * The Reports hub (analysis II · R-2).
 *
 * WHAT THIS REPLACES. "Insights" was a navigation ZONE containing one item,
 * whose route was owned by the Students module — a zone pointing at another
 * module's tab. The requirements doc's verdict: either it is a module with a
 * hub, or it should not be a zone.
 *
 * The catalogue states WHAT EACH REPORT ANSWERS rather than naming it. A list
 * of report titles requires the reader to already know which one holds the
 * number they want, which is the knowledge a hub exists to supply.
 *
 * The two cards that point INTO other modules are marked as doing so. Day Book,
 * Unpaid by Section and the Attendance Register are operational tools used
 * inside a workflow, not analysis, and the requirements doc is explicit that
 * they stay where they are — but a reader looking for "the attendance numbers"
 * should be told where they live, not left to conclude the product has none.
 */

type Entry = {
  key: string;
  href: string;
  icon: LucideIcon;
  titleBn: string;
  titleEn: string;
  /** The question it answers, in the reader's words. */
  answersBn: string;
  answersEn: string;
  permission: string;
  /** Lives in another module — labelled, not hidden. */
  elsewhereBn?: string;
  elsewhereEn?: string;
};

const CATALOGUE: Entry[] = [
  {
    key: "at-risk",
    href: "/admin/reports/at-risk",
    icon: LifeBuoy,
    titleBn: "ঝুঁকিতে থাকা শিক্ষার্থী",
    titleEn: "At-risk register",
    answersBn: "কোন শিক্ষার্থীদের ঝরে পড়ার ঝুঁকি রয়েছে, এবং কেন?",
    answersEn: "Which children are at risk of dropping out, and why?",
    permission: "student.view",
  },
  {
    key: "academic",
    href: "/admin/reports/academic",
    icon: GraduationCap,
    titleBn: "একাডেমিক ফলাফল",
    titleEn: "Academic performance",
    answersBn: "গ্রেড বিন্যাস, পাশের হার, কোন বিষয় কঠিন, কোন শাখা এগিয়ে?",
    answersEn: "Grade distribution, pass rate, which subject is hard, which section leads?",
    permission: "exam.view",
  },
  {
    key: "enrolment",
    href: "/admin/reports/enrolment",
    icon: Users,
    titleBn: "ভর্তি ও জনমিতি",
    titleEn: "Enrolment & demographics",
    answersBn: "আমাদের ভর্তির আকার কেমন — শ্রেণি, লিঙ্গ, ধর্ম ও বয়স অনুযায়ী?",
    answersEn: "What is the shape of our enrolment — by class, gender, religion and age?",
    permission: "student.view",
  },
  {
    key: "attendance",
    href: "/admin/attendance/analytics",
    icon: CalendarCheck,
    titleBn: "উপস্থিতি বিশ্লেষণ",
    titleEn: "Attendance analytics",
    answersBn: "উপস্থিতির প্রবণতা কী, এবং কারা নিয়মিত অনুপস্থিত?",
    answersEn: "What is the attendance trend, and who is chronically absent?",
    permission: "attendance.view",
    elsewhereBn: "উপস্থিতি মডিউলে",
    elsewhereEn: "in the Attendance module",
  },
  {
    key: "finance",
    href: "/admin/fee/income-statement",
    icon: Wallet,
    titleBn: "আয় বিবরণী",
    titleEn: "Income statement",
    answersBn: "একটি সময়ে কত আদায় হয়েছে, কোন খাতে?",
    answersEn: "What was collected over a period, and under which heads?",
    permission: "fee.view",
    elsewhereBn: "ফি মডিউলে",
    elsewhereEn: "in the Fees module",
  },
];

export function ReportsHubScreen() {
  const { t, isBn } = useT();
  const { data: permissions } = useMyPermissions();
  // Same fail-open rule as the navigation rail: undefined (loading) and []
  // (an account never seeded with roles) show everything. RLS is the control.
  const can = (code: string) => !permissions || permissions.length === 0 || permissions.includes(code);
  const entries = CATALOGUE.filter((e) => can(e.permission));

  return (
    <div className="flex flex-col gap-6 pb-6">
      <PageHeader
        title={t("রিপোর্ট", "Reports")}
        subtitle={t(
          "সিদ্ধান্ত নেওয়ার জন্য প্রতিষ্ঠানব্যাপী বিশ্লেষণ ও প্রিন্টযোগ্য প্রতিবেদন",
          "Institution-wide analysis and printable returns, for the decisions they support",
        )}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {entries.map((e) => {
          const Icon = e.icon;
          const elsewhere = isBn ? e.elsewhereBn : e.elsewhereEn;
          return (
            <Link
              key={e.key}
              href={e.href}
              className={cn(
                "group flex flex-col gap-3 rounded-2xl bg-surface p-5 shadow-e1 transition-shadow",
                "hover:shadow-e2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
              )}
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary-subtle text-primary">
                <Icon size={19} />
              </span>
              <span>
                <span className="block text-base font-semibold text-text-primary">
                  {isBn ? e.titleBn : e.titleEn}
                </span>
                {elsewhere ? (
                  <span className="mt-0.5 block text-micro text-text-muted">{elsewhere}</span>
                ) : null}
              </span>
              <span className="flex-1 text-meta text-text-secondary">{isBn ? e.answersBn : e.answersEn}</span>
              <span className="flex items-center gap-1.5 text-meta font-semibold text-primary">
                {t("খুলুন", "Open")}
                <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          );
        })}
      </div>

      {entries.length === 0 ? (
        <p className="rounded-2xl bg-surface p-5 text-meta text-text-muted shadow-e1">
          <BarChart3 size={18} className="mr-2 inline" />
          {t(
            "আপনার ভূমিকায় কোনো রিপোর্ট দেখার অনুমতি নেই।",
            "Your role does not have permission to view any report.",
          )}
        </p>
      ) : null}
    </div>
  );
}
