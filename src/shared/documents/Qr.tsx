"use client";

import { useMemo } from "react";
import { encodeQr } from "./qrEncode";

/**
 * QR as inline SVG — vector, so it prints crisp at 12 mm on a card and at
 * 30 mm on a certificate without a raster asset or a network round trip.
 *
 * The quiet zone is drawn here rather than in the encoder: four modules of
 * white margin is a *rendering* requirement of the scanning spec, and a caller
 * placing the code on an already-white sheet still needs it to be part of the
 * viewBox so the size the caller asks for is the size that scans.
 */
export function Qr({ value, sizeMm, className }: { value: string; sizeMm: number; className?: string }) {
  const grid = useMemo(() => {
    try {
      return encodeQr(value);
    } catch {
      // A document must still print if a verification URL is somehow oversized.
      // A missing QR is a degraded artefact; a thrown render is no artefact.
      return null;
    }
  }, [value]);

  if (!grid) return null;
  const quiet = 4;
  const span = grid.length + quiet * 2;

  // One path for every dark module beats one <rect> each: a version-6 code is
  // ~700 rects, and 40 of those on a card sheet is a document the browser
  // struggles to lay out.
  const d = grid
    .flatMap((row, y) => row.map((on, x) => (on ? `M${x + quiet} ${y + quiet}h1v1h-1z` : "")))
    .join("");

  return (
    <svg
      viewBox={`0 0 ${span} ${span}`}
      width={`${sizeMm}mm`}
      height={`${sizeMm}mm`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={value}
      className={className}
    >
      {/* Literal black on literal white, not design tokens. A QR is a machine
          target with a contrast requirement, and it is printed — a themed
          colour would emit indigo on paper and an inverted code in dark mode,
          neither of which scans. */}
      <rect width={span} height={span} fill="white" />
      <path d={d} fill="black" />
    </svg>
  );
}
