"use client";

import { useEffect } from "react";
import { Button, ErrorState } from "@/shared/ui";
import { useT } from "@/shared/i18n/useT";
import { reportError } from "@/shared/services/observability";

/** Error boundary for every /parent/* segment — see the admin one for rationale. */
export default function ParentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useT();

  useEffect(() => {
    reportError(error, "boundary:parent");
  }, [error]);

  return (
    <div className="py-10">
      <ErrorState
        title={t("কিছু একটা ভুল হয়েছে", "Something went wrong")}
        description={t(
          "তথ্য লোড করা যায়নি। আবার চেষ্টা করুন।",
          "We couldn't load this information. Please try again.",
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
