"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

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
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

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
