"use client";

import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { cn } from "@/shared/lib/cn";
import { LOCALE_COOKIE, type Locale } from "@/shared/i18n/config";

/** Always-visible Bn/En toggle — writes the locale cookie and refreshes. */
export function LocaleToggle({ className }: { className?: string }) {
  const locale = useLocale();
  const router = useRouter();

  function setLocale(next: Locale) {
    document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=31536000`;
    router.refresh();
  }

  return (
    <div
      className={cn(
        "inline-flex overflow-hidden rounded-md border border-border-default text-sm",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setLocale("bn")}
        className={cn(
          "px-2.5 py-1.5",
          locale === "bn"
            ? "bg-primary text-text-on-primary"
            : "text-text-secondary hover:bg-sunken",
        )}
      >
        বাং
      </button>
      <button
        type="button"
        onClick={() => setLocale("en")}
        className={cn(
          "font-latin px-2.5 py-1.5",
          locale === "en"
            ? "bg-primary text-text-on-primary"
            : "text-text-secondary hover:bg-sunken",
        )}
      >
        EN
      </button>
    </div>
  );
}
