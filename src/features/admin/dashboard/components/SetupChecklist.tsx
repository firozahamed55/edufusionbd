"use client";

import Link from "next/link";
import { Check, ChevronRight, Rocket } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";

/**
 * First-run guided setup (audit B-8).
 *
 * All 56 screens assumed classes, subjects, sections and grading schemes
 * already existed, because development always ran against a seeded institution.
 * A brand-new school landed on a dashboard of zeroes with no ordered path
 * through the mandatory setup — the first ten minutes of every new customer,
 * which is the highest-churn moment for a 100-to-500-school product.
 *
 * Steps are ordered by real dependency: sections need classes, subject groups
 * need subjects, students need somewhere to enrol.
 */
export function SetupChecklist({
  hasClasses,
  hasSubjects,
  hasStudents,
}: {
  hasClasses: boolean;
  hasSubjects: boolean;
  hasStudents: boolean;
}) {
  const { t } = useT();

  const steps = [
    {
      done: true,
      title: t("প্রতিষ্ঠানের তথ্য", "Institution details"),
      desc: t("নাম, ঠিকানা ও লোগো", "Name, address and logo"),
      href: "/admin/core/basic-config",
    },
    {
      done: hasClasses,
      title: t("শ্রেণি ও শাখা", "Classes & sections"),
      desc: t("শ্রেণি এবং তার শাখাগুলি তৈরি করুন", "Create your classes and their sections"),
      href: "/admin/core/class",
    },
    {
      done: hasSubjects,
      title: t("বিষয় ও গ্রেডিং", "Subjects & grading"),
      desc: t("বিষয় তালিকা, গ্রুপ ও গ্রেডিং স্কিম", "Subject list, groups and grading scheme"),
      href: "/admin/core/subject",
    },
    {
      done: hasStudents,
      title: t("শিক্ষার্থী ভর্তি", "Enrol students"),
      desc: t("প্রথম শিক্ষার্থী নিবন্ধন করুন", "Register your first students"),
      href: "/admin/student/registration",
    },
  ];

  const nextStep = steps.find((s) => !s.done);
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border-default bg-surface p-5 shadow-e1">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-subtle text-primary">
          <Rocket size={20} aria-hidden />
        </span>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-text-primary">
            {t("প্রতিষ্ঠান চালু করুন", "Set up your institution")}
          </h2>
          <p className="mt-0.5 text-meta text-text-muted">
            {t(
              `${doneCount} / ${steps.length} ধাপ সম্পন্ন`,
              `${doneCount} of ${steps.length} steps complete`,
            )}
          </p>
        </div>
      </div>

      <ol className="flex flex-col gap-2">
        {steps.map((s) => (
          <li key={s.href}>
            <Link
              href={s.href}
              aria-current={s === nextStep ? "step" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
                s === nextStep ? "bg-primary-subtle" : "bg-sunken hover:brightness-95",
              )}
            >
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full border",
                  s.done
                    ? "border-success-fg bg-success-bg text-success-fg"
                    : "border-border-control text-text-decorative",
                )}
              >
                {s.done ? <Check size={13} aria-hidden /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block truncate text-sm font-semibold",
                    s.done ? "text-text-muted line-through" : "text-text-primary",
                  )}
                >
                  {s.title}
                </span>
                <span className="block truncate text-xs text-text-muted">{s.desc}</span>
              </span>
              {!s.done ? <ChevronRight size={16} className="shrink-0 text-text-muted" /> : null}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
