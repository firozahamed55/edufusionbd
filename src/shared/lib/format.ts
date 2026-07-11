import type { Locale } from "@/shared/i18n/config";

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

/** Localize digits in a string/number to the active locale (Bengali or Latin). */
export function localizeDigits(value: string | number, locale: Locale): string {
  const s = String(value);
  if (locale !== "bn") return s;
  return s.replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);
}

/** Format a BDT money amount, digits localized. */
export function formatBDT(amount: number, locale: Locale): string {
  const formatted = new Intl.NumberFormat("en-BD", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
  return `৳${localizeDigits(formatted, locale)}`;
}

/** Format a date; digits localized to the active locale. */
export function formatDate(date: Date | string, locale: Locale): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const formatted = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
  return localizeDigits(formatted, locale);
}
