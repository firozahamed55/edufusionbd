"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Printer, X, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { Button } from "@/shared/ui";
import { PAPER, type PaperSize } from "./paper";

/**
 * The one print surface in the product (SRA A-0.5 point 2 / A-7 point 1).
 *
 * Every artefact — ID card, admit card, receipt, marksheet, tabulation sheet,
 * testimonial, transfer certificate — renders inside this, so page setup,
 * page-break control, the toolbar and the "what gets hidden when printing"
 * decision exist once instead of seven times.
 *
 * HOW THE PRINT ISOLATION WORKS. The overlay is portalled to `document.body`,
 * so it is a direct child of body and can be addressed by a sibling selector.
 * While it is mounted, `<html>` carries `data-doc-open`; `globals.css` then
 * hides every OTHER body child at print time. Without that, printing an
 * artefact opened on top of a screen prints the screen underneath it too — the
 * exact failure `data-print="hide"` alone could not solve, because the admin
 * shell's content is not opted out anywhere.
 *
 * `@page` is injected rather than declared in the stylesheet because the size
 * is per-document (CR80 sheets are A4, a receipt is an 80 mm roll) and `@page`
 * cannot be scoped to a selector.
 */
export function DocumentPreview({
  title,
  paper,
  onClose,
  toolbar,
  children,
}: {
  title: string;
  paper: PaperSize;
  onClose: () => void;
  /** Document-specific controls (layout picker, copies, …) rendered in the bar. */
  toolbar?: ReactNode;
  children: ReactNode;
}) {
  const { t, n } = useT();
  const [zoom, setZoom] = useState(1);
  const [mounted, setMounted] = useState(false);
  const p = PAPER[paper];

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.docOpen = "1";
    // The shell scrolls its own <main>; leaving that scrollable behind a modal
    // preview lets a stray wheel event move the page under the overlay.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      delete root.dataset.docOpen;
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div data-doc-root className="fixed inset-0 z-60 flex flex-col bg-canvas">
      <style>{`@page { size: ${p.size}; margin: ${p.marginMm}mm; }`}</style>

      <header data-print="hide" className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border-default bg-surface px-5 py-3 shadow-e1">
        <h2 className="text-base font-semibold text-text-primary">{title}</h2>
        <div className="flex items-center gap-1 rounded-lg border border-border-default px-1 py-0.5">
          <button
            type="button"
            aria-label={t("ছোট করুন", "Zoom out")}
            className="grid size-7 place-items-center rounded-md text-text-secondary hover:bg-sunken"
            onClick={() => setZoom((z) => Math.max(0.35, Math.round((z - 0.15) * 100) / 100))}
          >
            <ZoomOut size={15} />
          </button>
          <span className="w-12 text-center text-meta text-text-secondary tnum">{n(Math.round(zoom * 100))}%</span>
          <button
            type="button"
            aria-label={t("বড় করুন", "Zoom in")}
            className="grid size-7 place-items-center rounded-md text-text-secondary hover:bg-sunken"
            onClick={() => setZoom((z) => Math.min(1.5, Math.round((z + 0.15) * 100) / 100))}
          >
            <ZoomIn size={15} />
          </button>
        </div>
        {toolbar}
        <div className="flex-1" />
        <Button variant="primary" onClick={() => window.print()}>
          <Printer size={16} /> {t("প্রিন্ট", "Print")}
        </Button>
        <Button variant="secondary" onClick={onClose} aria-label={t("বন্ধ করুন", "Close")}>
          <X size={16} /> {t("বন্ধ", "Close")}
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-6">
        <div
          data-doc-pages
          className="mx-auto flex w-fit flex-col items-center gap-6 origin-top"
          style={{ transform: `scale(${zoom})` }}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * One printed page. Fixed physical size, `break-after: page`, and a
 * screen-only shadow so the preview reads as paper.
 *
 * Continuous stock (`heightMm: null`) gets `min-height` instead of `height`,
 * because a thermal receipt is exactly as long as its content.
 */
export function Page({
  paper,
  className,
  children,
}: {
  paper: PaperSize;
  className?: string;
  children: ReactNode;
}) {
  const p = PAPER[paper];
  return (
    <section
      data-doc-page
      className={cn("relative shrink-0 bg-white text-black shadow-e2 print:shadow-none", className)}
      style={{
        width: `${p.widthMm}mm`,
        ...(p.heightMm == null ? { minHeight: `${p.widthMm}mm` } : { height: `${p.heightMm}mm` }),
        padding: `${p.marginMm}mm`,
      }}
    >
      {children}
    </section>
  );
}
