"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { useT } from "@/shared/i18n/useT";
import { ThemeToggle, LocaleToggle } from "@/shared/ui";

/**
 * Split-panel authentication chrome — matched to the Figma login shots.
 *
 *   ┌─────────────────────┬──────────────────────────┐
 *   │  indigo brand rail   │  form column             │
 *   │  logo · headline ·   │  [Bn/En] [theme]         │
 *   │  feature bullets ·   │        ┌── card ──┐       │
 *   │  footer              │        │ children │       │
 *   └─────────────────────┴──────────────────────────┘
 *
 * The brand rail is hidden below `lg` so auth is a clean single column on
 * mobile (320px+). Both themes render from tokens; the rail keeps its indigo
 * identity in dark while the form canvas follows the theme. Language + theme
 * switchers are always visible on the auth canvas (audit 7.3).
 */
export function AuthShell({ children }: { children: ReactNode }) {
  const { t } = useT();

  const features = [
    t("অফলাইন উপস্থিতি ও স্বয়ংক্রিয় অভিভাবক অ্যালার্ট", "Offline attendance & automatic guardian alerts"),
    t("bKash / Nagad দিয়ে অনলাইন ফি", "Online fees via bKash / Nagad"),
    t("এডুসাথী — বাংলা ও Banglish-এ প্রশ্ন করুন", "EduSathi — ask in Bangla or Banglish"),
  ];

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(0,44%)_minmax(0,56%)]">
      {/* Brand rail */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-primary-hover px-12 py-10 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-lg bg-white text-lg font-black text-primary-hover">
            E
          </span>
          <span className="text-lg font-bold">EduFusionBD</span>
        </div>

        <div className="max-w-md">
          <h1 className="text-h1 font-black leading-[1.15] tracking-tight">
            {t("এক সিস্টেমে", "One system —")}
            <br />
            {t("পুরো স্কুল", "your whole school")}
          </h1>
          <p className="mt-4 text-body leading-relaxed text-white/70">
            {t(
              "উপস্থিতি, ফলাফল, ফি আদায় এবং এডুসাথী এআই সহকারী — সব এক জায়গায়, বাংলায়।",
              "Attendance, results, fee collection and the EduSathi AI assistant — all in one place, in Bangla.",
            )}
          </p>
          <ul className="mt-8 flex flex-col gap-3.5">
            {features.map((f) => (
              <li key={f} className="flex items-center gap-3 text-sm text-white/90">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-black/25">
                  <Check size={14} strokeWidth={3} />
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-white/50">
          {t(
            "© ২০২৬ EduFusionBD · বাংলাদেশের স্কুলের জন্য তৈরি",
            "© 2026 EduFusionBD · Built for schools in Bangladesh",
          )}
        </p>
      </aside>

      {/* Form column */}
      <main className="relative flex flex-col bg-canvas text-text-primary">
        <div className="flex items-center justify-end gap-2 px-6 pt-6">
          <LocaleToggle />
          <ThemeToggle />
        </div>

        {/* Mobile-only compact brand lockup (rail is hidden < lg) */}
        <div className="flex items-center gap-2 px-6 pt-6 lg:hidden">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-base font-black text-text-on-primary">
            E
          </span>
          <span className="text-base font-bold">EduFusionBD</span>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 py-10">
          <div className="w-full max-w-[420px]">{children}</div>
        </div>
      </main>
    </div>
  );
}

/** Card wrapper used by every auth screen — one radius/elevation vocabulary. */
export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border-default bg-surface p-7 shadow-e2">
      <h2 className="text-2xl font-bold text-text-primary">{title}</h2>
      {subtitle ? <p className="mt-1.5 text-sm text-text-secondary">{subtitle}</p> : null}
      <div className="mt-6">{children}</div>
      {footer ? <div className="mt-6">{footer}</div> : null}
    </section>
  );
}

/** "Back to login" link row shared by the recovery screens. */
export function AuthBackLink({ label }: { label: string }) {
  return (
    <Link
      href="/login"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-opacity hover:opacity-80"
    >
      ← {label}
    </Link>
  );
}
