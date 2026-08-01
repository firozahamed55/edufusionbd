"use client";

import { WifiOff } from "lucide-react";
import { useOnline } from "@/shared/lib/useOnline";

/**
 * Connection-loss warning (audit B-10).
 *
 * Attendance and mark entry are long, high-value form sessions, and Bangladeshi
 * school connectivity is intermittent — this is the most likely real-world
 * cause of lost work in the product. Nothing warned on connection loss; a
 * failed mutation surfaced as a toast *after* the data was gone.
 *
 * Deliberately only warns. Draft persistence belongs to the screens that own
 * the form state; a generic component cannot know what is worth saving.
 */
export function OfflineBanner({ message }: { message: string }) {
  // The listener wiring moved to `useOnline` so the auth screens can share it
  // without this component's layout (SRA B-7).
  const offline = !useOnline();

  if (!offline) return null;

  return (
    <div
      role="alert"
      data-print="hide"
      className="flex items-center gap-2.5 rounded-xl border border-warning-fg/40 bg-warning-bg px-4 py-2.5 text-meta font-medium text-warning-fg"
    >
      <WifiOff size={16} className="shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  );
}
