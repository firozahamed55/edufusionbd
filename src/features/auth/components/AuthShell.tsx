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
 *
 * PALETTE (SRA §4.4, revised). The report's direction was "depth, motion and
 * completeness, not a repaint", and the palette row said "unchanged". The
 * repaint was asked for anyway, so it is here — but scoped to `.auth-rail` and
 * `.auth-mark` in globals.css rather than applied to
 * `--color-interactive-primary`. The flat single-hue fill becomes a three-glow
 * mesh; the app-wide primary, which `tests/contrast.test.ts` and 44 admin
 * screens are written against, does not move. The rest of §4.4 lands with it:
 * `e1` on mobile / `e2` on desktop, the 480px form-column guard, and the
 * 320 ms card entrance — all motion-safe.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  const { t } = useT();

  /**
   * SRA A-4 names one of these as a live P0 — "offline attendance advertised on
   * the auth screen, not built". Checked against the roadmap, all three were:
   * the SMS gateway and the payment gateway are Phase 4 week 13 and EduSathi is
   * week 15, so the first screen every evaluator sees made three promises the
   * product could not demonstrate. Replaced with three that shipped —
   * attendance/results/fees (Phases 1–2), QR-verifiable documents (Phase 3
   * weeks 8–9), CSV import (week 11). Put a claim back here when it is true,
   * not when it is scheduled.
   */
  const features = [
    t("উপস্থিতি, ফলাফল ও ফি — এক সিস্টেমে", "Attendance, results and fees in one system"),
    t("আইডি কার্ড, প্রবেশপত্র ও রসিদ — QR দিয়ে যাচাইযোগ্য", "ID cards, admit cards and receipts — QR-verifiable"),
    t("CSV থেকে শিক্ষার্থী ও শিক্ষক আমদানি", "Import students and teachers straight from CSV"),
  ];

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(0,44%)_minmax(0,56%)]">
      {/* Brand rail */}
      <aside className="auth-rail relative hidden flex-col justify-between overflow-hidden px-12 py-10 text-white lg:flex">
        <div className="relative flex items-center gap-2.5">
          <span className="auth-mark grid size-9 place-items-center rounded-xl text-lg font-black text-white shadow-e2">
            E
          </span>
          <span className="text-lg font-bold">EduFusionBD</span>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-h1 font-black leading-[1.15] tracking-tight">
            {t("এক সিস্টেমে", "One system —")}
            <br />
            {t("পুরো স্কুল", "your whole school")}
          </h1>
          {/* /70 → /80: the mesh is lighter than the flat fill under it, and
              this line is body copy, not decoration. */}
          <p className="mt-4 text-body leading-relaxed text-white/80">
            {t(
              "উপস্থিতি, ফলাফল, ফি আদায় এবং এডুসাথী এআই সহকারী — সব এক জায়গায়, বাংলায়।",
              "Attendance, results, fee collection and the EduSathi AI assistant — all in one place, in Bangla.",
            )}
          </p>
          <ul className="mt-8 flex flex-col gap-3">
            {features.map((f) => (
              <li
                key={f}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/8 px-3.5 py-2.5 text-sm text-white/90 backdrop-blur-sm"
              >
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white/20">
                  <Check size={14} strokeWidth={3} />
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/60">
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
          <span className="auth-mark grid size-8 place-items-center rounded-lg text-base font-black text-white">
            E
          </span>
          <span className="text-base font-bold">EduFusionBD</span>
        </div>

        {/* 480px guard (§4.4): the column itself is 56% of the viewport, so on
            an ultrawide the card would otherwise stretch past a readable measure. */}
        <div className="flex flex-1 items-center justify-center px-6 py-10">
          <div className="w-full max-w-[min(480px,100%)]">{children}</div>
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
    // e1 on mobile, e2 from `sm` (§4.4): a card floating on a 360px screen
    // reads as heavy, and on mobile there is no rail behind it to float over.
    <section className="auth-card rounded-3xl border border-border-default bg-surface p-6 shadow-e1 sm:p-7 sm:shadow-e2">
      <h2 className="text-2xl font-bold tracking-tight text-text-primary">{title}</h2>
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
