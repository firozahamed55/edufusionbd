"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, LogOut, ChevronRight, User } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import { ThemeToggle, LocaleToggle } from "@/shared/ui";
import { Card, CardHead } from "@/features/parent/components";
import { useActiveChild } from "@/features/parent/state";
import { getGuardianName } from "@/features/parent/data";
import { createClient } from "@/shared/services/supabase/client";

export default function ParentProfile() {
  const { t, n } = useT();
  const router = useRouter();
  const { active, children } = useActiveChild();
  const guardian = getGuardianName();

  async function signOut() {
    try {
      await createClient().auth.signOut();
    } catch {
      /* no-op in preview without Supabase env */
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3.5">
      <h1 className="text-lg font-bold">{t("প্রোফাইল ও সেটিংস", "Profile & settings")}</h1>

      {/* Guardian */}
      <Card>
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-full bg-primary-subtle text-lg font-bold text-primary">
            {t(active.initial.bn, active.initial.en)}
          </span>
          <div>
            <p className="font-semibold">{t(guardian.bn, guardian.en)}</p>
            <p className="text-meta text-text-muted">
              {t("অভিভাবক", "Guardian")} · {n(children.length)} {t("সন্তান", "children")}
            </p>
          </div>
        </div>
      </Card>

      {/* Children */}
      <Card>
        <CardHead title={t("সন্তানগণ", "Children")} />
        <ul className="flex flex-col divide-y divide-border-default">
          {children.map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-2.5">
              <span className="grid size-9 place-items-center rounded-full bg-sunken text-sm font-semibold text-text-secondary">
                {t(c.initial.bn, c.initial.en)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text-primary">{t(c.name.bn, c.name.en)}</p>
                <p className="text-xs text-text-muted">
                  {t(c.className.bn, c.className.en)} · {t("রোল", "Roll")} {n(c.roll)}
                </p>
              </div>
              <User size={16} className="text-text-muted" />
            </li>
          ))}
        </ul>
      </Card>

      {/* Preferences */}
      <Card>
        <CardHead title={t("পছন্দসমূহ", "Preferences")} />
        <div className="flex items-center justify-between py-1.5">
          <span className="text-sm text-text-secondary">{t("ভাষা", "Language")}</span>
          <LocaleToggle />
        </div>
        <div className="flex items-center justify-between py-1.5">
          <span className="text-sm text-text-secondary">{t("থিম", "Theme")}</span>
          <ThemeToggle />
        </div>
      </Card>

      {/* Account actions */}
      <Card>
        <Link
          href="/change-password"
          className="flex items-center gap-3 py-1 text-sm font-medium text-text-primary"
        >
          <KeyRound size={18} className="text-text-secondary" />
          <span className="flex-1">{t("পাসওয়ার্ড পরিবর্তন", "Change password")}</span>
          <ChevronRight size={16} className="text-text-muted" />
        </Link>
      </Card>

      <button
        type="button"
        onClick={signOut}
        className="flex items-center justify-center gap-2 rounded-xl border border-danger-fg/30 bg-danger-bg/40 py-3 text-sm font-semibold text-danger-fg transition-colors hover:bg-danger-bg"
      >
        <LogOut size={18} /> {t("লগআউট", "Sign out")}
      </button>
    </div>
  );
}
