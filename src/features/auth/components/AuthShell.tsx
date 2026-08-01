"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { ThemeToggle, LocaleToggle } from "@/shared/ui";

/**
 * Split-panel authentication chrome.
 *
 *   ┌──────────────┬──────────────────────────────┐
 *   │  ink rail    │  form column                 │
 *   │  wordmark ·  │  [Bn/En] [theme]             │
 *   │  headline ·  │        form (no card at lg)  │
 *   │  footer      │                              │
 *   └──────────────┴──────────────────────────────┘
 *
 * REDESIGN (requirements analysis II §A). Four decisions dated this screen, and
 * all four are gone:
 *
 *   1. The rail was 44% of the viewport and carried an animated three-glow
 *      gradient mesh. It is now 36% (40% at 2xl) and flat — see `.auth-rail` in
 *      globals.css for why the mesh, not the indigo, was the problem.
 *   2. Three white/10 check-pills listed features. They said nothing a
 *      competitor's page doesn't, and checkmark-pill lists are visual filler.
 *      They are removed rather than rewritten: the honest replacement is one
 *      concrete proof (a real figure, a named institution), the product has
 *      neither yet, and whitespace outperforms filler. Put a proof block back
 *      here when there is a proof — not when there is a gap.
 *   3. The form floated in a `rounded-3xl` + `shadow-e2` card on a tinted
 *      canvas. On desktop the form now sits directly on the surface; the card
 *      survives below `lg`, where there is no rail behind it to float over and
 *      the container is what separates the form from the edge of the phone.
 *   4. The logo was an "E" in a gradient rounded square — the default
 *      AI-generated-logo look. See `Wordmark`.
 *
 * The token architecture is untouched: raw Figma variables → `@theme inline`
 * semantic utilities, dual-mode, contrast-tested. That part was never the
 * problem, and ~110 admin screens are written against it.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  const { t } = useT();

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(0,36%)_minmax(0,64%)] 2xl:grid-cols-[minmax(0,40%)_minmax(0,60%)]">
      {/* Brand rail — hidden below `lg`, so auth is a clean single column from
          320px up. Three elements: mark, statement, footer. */}
      <aside className="auth-rail relative hidden flex-col justify-between overflow-hidden px-10 py-10 text-white lg:flex xl:px-12">
        <Wordmark tone="rail" />

        <div className="max-w-sm">
          {/* `text-h2` (32px), not the 40px `text-h1` this screen used to own:
              against a 36% rail the larger size wrapped the Bangla headline to
              four lines. h2 was a genuine hole in the named scale — the tokens
              ran h4, h3, h1 — so this fills it rather than adding an arbitrary
              value, which the lint rule rightly bans. */}
          <h1 className="text-h2 font-bold leading-tight tracking-tight">
            {t("এক সিস্টেমে", "One system —")}
            <br />
            {t("পুরো স্কুল", "your whole school")}
          </h1>
          <p className="mt-4 text-body leading-relaxed text-white/75">
            {t(
              "উপস্থিতি, ফলাফল, ফি আদায় এবং এডুসাথী এআই সহকারী — সব এক জায়গায়, বাংলায়।",
              "Attendance, results, fee collection and the EduSathi AI assistant — all in one place, in Bangla.",
            )}
          </p>
        </div>

        <p className="text-xs text-white/55">
          {t(
            "© ২০২৬ EduFusionBD · বাংলাদেশের স্কুলের জন্য তৈরি",
            "© 2026 EduFusionBD · Built for schools in Bangladesh",
          )}
        </p>
      </aside>

      {/* Form column */}
      <main className="relative flex flex-col bg-canvas text-text-primary">
        <div className="flex items-center gap-3 px-6 pt-6">
          {/* The rail is hidden below `lg`, so the wordmark moves inline here
              rather than occupying a row of its own on a 360px screen. */}
          <div className="lg:hidden">
            <Wordmark tone="page" />
          </div>
          {/* Language + theme switchers stay visible on the auth canvas (audit 7.3). */}
          <div className="ml-auto flex items-center gap-2">
            <LocaleToggle />
            <ThemeToggle />
          </div>
        </div>

        {/* The column is 64% of the viewport, so on an ultrawide the form would
            otherwise stretch well past a readable measure. */}
        <div className="flex flex-1 items-center justify-center px-6 py-10">
          <div className="w-full max-w-[min(480px,100%)]">{children}</div>
        </div>
      </main>
    </div>
  );
}

/**
 * Typographic wordmark.
 *
 * Replaces the gradient-filled "E" tile. A real mark is a branding task, not a
 * CSS one — so rather than swap one placeholder for another, this ships type
 * only. Type is honest about being type, and it does not date.
 */
function Wordmark({ tone }: { tone: "rail" | "page" }) {
  const onRail = tone === "rail";
  return (
    <span
      className={cn(
        "text-lg font-bold tracking-tight",
        onRail ? "text-white" : "text-text-primary",
      )}
    >
      EduFusion
      <span className={onRail ? "text-white/55" : "text-primary"}>BD</span>
    </span>
  );
}

/**
 * The wrapper every auth screen's content sits in.
 *
 * Card chrome below `lg` only. At `lg` and up the rail supplies the separation
 * a card was providing, and a card floating on a surface that is already
 * distinct from the panel beside it is the pattern this redesign removed.
 */
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
    <section className="auth-card rounded-2xl border border-border-default bg-surface p-6 shadow-e1 sm:p-7 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
      <h2 className="text-2xl font-bold tracking-tight text-text-primary lg:text-h3">
        {title}
      </h2>
      {subtitle ? <p className="mt-2 text-sm leading-relaxed text-text-secondary">{subtitle}</p> : null}
      <div className="mt-7">{children}</div>
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
