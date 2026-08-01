"use client";

import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, Lightbulb, Printer, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { formatDateTime } from "@/shared/lib/format";
import { PageHeader } from "@/shared/ui";
import type { Finding, FindingTone } from "../logic/insights";

/**
 * The chrome every report owes (analysis II · R-8, R-9, R-3).
 *
 * The requirements doc's cross-cutting contract lists six things a report owes
 * and records that the one report in the product delivered two. Three of the
 * four missing ones are the same shape on every report, so they live here
 * rather than being re-remembered per screen:
 *
 *  - R-8 PRINT. `globals.css` has shipped a considered print stylesheet since
 *    the B-6 audit — `@page { margin: 12mm }`, chrome suppressed, table headers
 *    repeated across pages — and exactly one screen in the product used it.
 *    Bangladeshi schools submit printed returns to the education office; the
 *    printed sheet is the actual deliverable, not a convenience.
 *
 *  - R-9 PROVENANCE. As-of time, the filters applied, and the definitions
 *    behind any computed figure. A printed report that does not state its own
 *    filters is unciteable: the reader cannot tell whether "268 students" is
 *    the school or one section of it, and neither can the person who printed it
 *    a month later. This block is deliberately NOT `data-print="hide"` — it is
 *    the part that most needs to survive onto paper.
 *
 *  - R-3 FINDINGS. Rendered above the tables, because the interpretation is
 *    what the reader came for and the tables are the evidence for it.
 *
 * The `<main>` content is marked `data-print="sheet"` so the print stylesheet
 * already in the codebase picks it up with no new CSS.
 */

export type ReportProvenance = {
  /** Filters, already localised into "label: value" pairs by the screen. */
  filters: { label: string; value: string }[];
  /** How a computed figure on this report is defined (D-14's other half). */
  definitions?: { term: string; meaning: string }[];
  /** When the underlying query returned, not when the component rendered. */
  fetchedAt?: number;
};

export function ReportShell({
  title,
  subtitle,
  actions,
  findings,
  provenance,
  children,
}: {
  title: string;
  subtitle?: string;
  /** Export button etc. Suppressed on paper — a printed button is a smudge. */
  actions?: ReactNode;
  findings?: Finding[];
  provenance: ReportProvenance;
  children: ReactNode;
}) {
  const { t } = useT();

  return (
    <div className="flex flex-col gap-6 pb-6">
      <div className="flex flex-wrap items-start gap-3">
        <PageHeader className="flex-1" title={title} subtitle={subtitle} />
        <div className="flex items-center gap-2" data-print="hide">
          {actions}
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border-strong bg-surface px-4 text-meta font-semibold text-text-secondary hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            <Printer size={16} /> {t("প্রিন্ট", "Print")}
          </button>
        </div>
      </div>

      {findings && findings.length > 0 ? <Findings findings={findings} /> : null}

      <div data-print="sheet" className="flex flex-col gap-6">
        {children}
      </div>

      <Provenance {...provenance} />
    </div>
  );
}

/* ------------------------------------------------------------- findings */

const TONE: Record<FindingTone, { icon: typeof Info; cls: string; iconCls: string }> = {
  critical: { icon: TriangleAlert, cls: "border-danger-solid/30 bg-danger-bg", iconCls: "text-danger-fg" },
  warning: { icon: AlertTriangle, cls: "border-warning-fg/30 bg-warning-bg", iconCls: "text-warning-fg" },
  neutral: { icon: Info, cls: "border-border-default bg-sunken", iconCls: "text-text-muted" },
  positive: { icon: CheckCircle2, cls: "border-success-fg/30 bg-success-bg", iconCls: "text-success-fg" },
};

/**
 * The interpretation layer, rendered.
 *
 * Each row carries the RULE that produced it, in a quieter style beside the
 * finding. That is not decoration: a reader who thinks 75% is the wrong floor
 * can see that 75% is the floor and discount the line accordingly. A finding
 * whose threshold is invisible has to be taken on faith, and this product's
 * whole problem with its dashboard was figures taken on faith.
 */
export function Findings({ findings }: { findings: Finding[] }) {
  const { t, n, isBn } = useT();
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-surface p-5 shadow-e1">
      <div className="flex items-center gap-2">
        <Lightbulb size={16} className="text-primary" />
        <h2 className="text-base font-semibold text-text-primary">{t("যা লক্ষ্য করার মতো", "What stands out")}</h2>
      </div>
      <ul className="flex flex-col gap-2.5">
        {findings.map((f) => {
          const tone = TONE[f.tone];
          const Icon = tone.icon;
          const body = (
            <>
              <Icon size={15} className={cn("mt-0.5 shrink-0", tone.iconCls)} />
              <span className="flex-1">
                {/*
                  `n()` here rather than at every interpolation inside the rule
                  module. The insight engine is pure and locale-agnostic — it
                  computes findings, it does not know which numeral system the
                  reader is in — so the numerals are converted at the point of
                  rendering, once, instead of at ~30 template literals that
                  each have to remember. Without it a Bengali page renders its
                  findings in Latin digits, which is the one place on the
                  screen a reader is asked to trust a number.
                */}
                <span className="block text-sm text-text-primary">{n(isBn ? f.bn : f.en)}</span>
                <span className="mt-0.5 block text-micro text-text-muted">
                  {t("নিয়ম", "Rule")}: {n(isBn ? f.ruleBn : f.ruleEn)}
                </span>
              </span>
            </>
          );
          return (
            <li key={f.key} className={cn("flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5", tone.cls)}>
              {/* A finding with somewhere to go is a link; one without is not
                  dressed up as a control that does nothing. */}
              {f.href ? (
                <Link href={f.href} className="flex flex-1 items-start gap-2.5 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring">
                  {body}
                </Link>
              ) : (
                body
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ----------------------------------------------------------- provenance */

function Provenance({ filters, definitions, fetchedAt }: ReportProvenance) {
  const { t, n } = useT();
  return (
    <footer className="flex flex-col gap-2 rounded-2xl border border-border-default bg-sunken px-5 py-4 text-micro text-text-muted">
      <p className="font-semibold text-text-secondary">{t("এই রিপোর্ট সম্পর্কে", "About this report")}</p>
      <dl className="flex flex-col gap-1">
        <div className="flex flex-wrap gap-1.5">
          <dt className="font-medium">{t("ফিল্টার", "Filters")}:</dt>
          <dd>
            {filters.length === 0
              ? t("কোনো ফিল্টার প্রয়োগ করা হয়নি — সম্পূর্ণ প্রতিষ্ঠান", "None applied — the whole institution")
              : filters.map((f) => `${f.label}: ${f.value}`).join(" · ")}
          </dd>
        </div>
        {definitions?.map((d) => (
          <div key={d.term} className="flex flex-wrap gap-1.5">
            <dt className="font-medium">{d.term}:</dt>
            <dd>{d.meaning}</dd>
          </div>
        ))}
        {fetchedAt ? (
          <div className="flex flex-wrap gap-1.5">
            <dt className="font-medium">{t("তথ্য নেওয়ার সময়", "Data as of")}:</dt>
            {/* `n()` so the timestamp carries Bengali numerals with the rest of
                the page — a printed return that mixes numeral systems reads as
                two documents stapled together. */}
            <dd className="tnum">{n(formatDateTime(fetchedAt))}</dd>
          </div>
        ) : null}
      </dl>
    </footer>
  );
}
