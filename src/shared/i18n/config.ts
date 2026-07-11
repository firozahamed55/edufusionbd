export const locales = ["bn", "en"] as const;
export type Locale = (typeof locales)[number];

/** Bangla-first, per the design system. */
export const defaultLocale: Locale = "bn";

export const LOCALE_COOKIE = "NEXT_LOCALE";
