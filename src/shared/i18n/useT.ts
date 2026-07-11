"use client";

import { useLocale } from "next-intl";
import type { Locale } from "./config";

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"] as const;
const BN_DIGIT_RE = /[০-৯]/g;
const ASCII_DIGIT_RE = /[0-9]/g;

/** Normalize any Bengali digits in a string to ASCII (0–9). */
function digitsToAscii(value: string): string {
  return value.replace(BN_DIGIT_RE, (d) => String(BN_DIGITS.indexOf(d as (typeof BN_DIGITS)[number])));
}

/** Convert ASCII digits in a string to Bengali numerals. */
function digitsToBn(value: string): string {
  return value.replace(ASCII_DIGIT_RE, (d) => BN_DIGITS[Number(d)]);
}

export type Bilingual = { bn: string; en: string };

/**
 * Screen-level i18n for the admin app.
 *
 *   const { t, n, locale, isBn } = useT();
 *   t("শিক্ষার্থী তালিকা", "Student List")   // active-locale string
 *   n("২০৯২২২৬")                             // numerals in active locale
 *   n(45)                                     // → "৪৫" (bn) or "45" (en)
 *
 * `t` picks the active-locale text — layout-neutral (returns plain strings, so
 * className/spacing are unchanged and bn/en stay pixel-identical). `n` renders
 * numerals in the active locale and accepts source data written in EITHER
 * Bengali or ASCII digits, so it is safe to wrap any existing hardcoded number
 * without first rewriting the data.
 */
export function useT() {
  const locale = useLocale() as Locale;
  const isBn = locale === "bn";

  const t = (bn: string, en: string) => (isBn ? bn : en);
  const tb = (b: Bilingual) => (isBn ? b.bn : b.en);
  const n = (value: string | number) => {
    const ascii = digitsToAscii(String(value));
    return isBn ? digitsToBn(ascii) : ascii;
  };

  return { locale, isBn, t, tb, n };
}
