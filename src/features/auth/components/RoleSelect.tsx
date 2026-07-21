"use client";

import Link from "next/link";
import { ShieldCheck, GraduationCap, Users, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import { AuthShell, AuthCard } from "./AuthShell";
import { ROLE_LABELS, type Role } from "./roles";

/**
 * Role Selection — the unified entry point for all three roles. Each card links
 * to the shared login screen carrying the chosen role (`/login?role=…`); the
 * login header then shows that role and Supabase authenticates. The signed-in
 * JWT role remains authoritative for which dashboard the user finally lands on.
 */
const ROLES: { key: Role; icon: LucideIcon; desc: { bn: string; en: string } }[] = [
  {
    key: "admin",
    icon: ShieldCheck,
    desc: { bn: "পুরো স্কুল পরিচালনা করুন", en: "Manage the whole school" },
  },
  {
    key: "teacher",
    icon: GraduationCap,
    desc: { bn: "উপস্থিতি, নম্বর ও ক্লাস", en: "Attendance, marks & classes" },
  },
  {
    key: "parent",
    icon: Users,
    desc: { bn: "সন্তানের অগ্রগতি দেখুন", en: "Track your child's progress" },
  },
];

export function RoleSelect() {
  const { t } = useT();

  return (
    <AuthShell>
      <AuthCard
        title={t("আপনি কে?", "Who are you?")}
        subtitle={t(
          "চালিয়ে যেতে আপনার ভূমিকা নির্বাচন করুন",
          "Select your role to continue",
        )}
      >
        <ul className="flex flex-col gap-3">
          {ROLES.map(({ key, icon: Icon, desc }) => (
            <li key={key}>
              <Link
                href={`/login?role=${key}`}
                className="group flex items-center gap-4 rounded-xl border border-border-strong bg-surface px-4 py-3.5 transition-colors hover:border-primary hover:bg-sunken focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                aria-label={t(
                  `${ROLE_LABELS[key].bn} হিসেবে লগইন করুন`,
                  `Sign in as ${ROLE_LABELS[key].en}`,
                )}
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary-subtle text-primary">
                  <Icon size={22} strokeWidth={2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-semibold text-text-primary">
                    {t(ROLE_LABELS[key].bn, ROLE_LABELS[key].en)}
                  </span>
                  <span className="block text-meta text-text-secondary">
                    {t(desc.bn, desc.en)}
                  </span>
                </span>
                <ChevronRight
                  size={18}
                  className="shrink-0 text-text-muted transition-colors group-hover:text-primary"
                />
              </Link>
            </li>
          ))}
        </ul>
      </AuthCard>
    </AuthShell>
  );
}
