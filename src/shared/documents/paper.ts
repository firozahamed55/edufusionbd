/**
 * Paper stock for the document rendering layer (SRA A-0.5 / A-7).
 *
 * WHY MILLIMETRES AND NOT PIXELS. Every artefact here is a physical object —
 * a CR80 card that must fit a lanyard holder, an A5 receipt torn off at a cash
 * counter, an 80 mm thermal roll. A px-sized template prints at whatever the
 * browser's px→mm ratio happens to be, which is a different size on every
 * machine. Millimetres are the only unit that survives the trip to paper.
 *
 * WHY NO PDF LIBRARY. The Result Sheet already proved that `print.css` +
 * `window.print()` produces a clean artefact and a browser "Save as PDF" for
 * free (SRA A-5.2). A headless renderer is the right answer only for signed
 * archival copies, which A-7 explicitly defers.
 */

export type PaperSize = "a4" | "a4-landscape" | "a5" | "a5-landscape" | "thermal80";

export type Paper = {
  /** The `@page { size: … }` value. */
  size: string;
  /** Trim width in mm — the `Page` element's own width. */
  widthMm: number;
  /** Trim height in mm. `null` = continuous stock (thermal roll). */
  heightMm: number | null;
  /** Page margin in mm, applied both to `@page` and to the on-screen page. */
  marginMm: number;
};

export const PAPER: Record<PaperSize, Paper> = {
  a4: { size: "A4 portrait", widthMm: 210, heightMm: 297, marginMm: 12 },
  "a4-landscape": { size: "A4 landscape", widthMm: 297, heightMm: 210, marginMm: 12 },
  a5: { size: "A5 portrait", widthMm: 148, heightMm: 210, marginMm: 10 },
  "a5-landscape": { size: "A5 landscape", widthMm: 210, heightMm: 148, marginMm: 10 },
  // Continuous roll: height is whatever the content is, so `@page` gets `auto`
  // and the cutter does the rest. A fixed height here would feed blank paper.
  thermal80: { size: "80mm auto", widthMm: 80, heightMm: null, marginMm: 4 },
};

/** ISO/IEC 7810 ID-1 — the credit-card / school-ID format. */
export const CR80 = { widthMm: 85.6, heightMm: 54 } as const;

/**
 * How many CR80 cards go on one A4 sheet, and in what grid.
 *
 * 2-up and 8-up are what A-7 asks for; 10-up is what actually fits (5 rows of
 * 2 inside a 186 × 273 mm print area) and is the layout a school printing 800
 * cards will use, so it is offered rather than left as a comment.
 */
export const CARD_LAYOUTS = {
  "1up": { cols: 1, perPage: 1 },
  "2up": { cols: 1, perPage: 2 },
  "8up": { cols: 2, perPage: 8 },
  "10up": { cols: 2, perPage: 10 },
} as const;

export type CardLayout = keyof typeof CARD_LAYOUTS;

/** Split a list into pages of `perPage` items. Always ≥ 1 page, so an empty
 *  batch previews as one blank sheet rather than rendering nothing at all. */
export function paginate<T>(items: readonly T[], perPage: number): T[][] {
  if (perPage < 1) throw new Error("perPage must be >= 1");
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += perPage) pages.push(items.slice(i, i + perPage));
  return pages.length > 0 ? pages : [[]];
}
