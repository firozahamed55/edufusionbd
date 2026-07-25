"use client";

import { useEffect } from "react";
import { Button, ErrorState } from "@/shared/ui";
import { useT } from "@/shared/i18n/useT";
import { reportError } from "@/shared/services/observability";

/**
 * Error boundary for every /admin/* segment.
 *
 * Without this file an uncaught render/data error unmounts the whole tree and
 * the operator gets a blank white page with no way back. Scoped to the segment,
 * so the AdminShell (sidebar + topbar) survives and `reset()` re-renders just
 * the failed screen.
 *
 * `digest` is the only safe thing to surface: Next replaces production error
 * messages with it server-side, and it is what correlates this screen to the
 * server log line.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useT();

  useEffect(() => {
    // Structured + scrubbed, so this line is greppable next to the server-side
    // `onRequestError` line for the same `digest` (see src/instrumentation.ts).
    reportError(error, "boundary:admin");
  }, [error]);

  return (
    <div className="py-10">
      <ErrorState
        title={t("কিছু একটা ভুল হয়েছে", "Something went wrong")}
        description={t(
          "এই স্ক্রিনটি লোড করা যায়নি। আবার চেষ্টা করুন — সমস্যা থাকলে সাপোর্টে জানান।",
          "This screen could not be loaded. Try again — if it persists, contact support.",
        )}
        action={
          <div className="flex flex-col items-center gap-2">
            <Button onClick={reset}>{t("আবার চেষ্টা করুন", "Try again")}</Button>
            {error.digest ? (
              <p className="font-latin text-meta text-text-muted">
                {t("রেফারেন্স", "Reference")}: {error.digest}
              </p>
            ) : null}
          </div>
        }
      />
    </div>
  );
}
