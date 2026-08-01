/**
 * Date/time formatting bound to the *institution's* timezone, not the browser's
 * and not UTC.
 *
 * Why this file exists (SRA A-0.8): the product formatted dates three different
 * ways and two of them were wrong for its audience.
 *
 *  - `new Date(x).toISOString().slice(0,10)` reports the **UTC** day. Bangladesh
 *    is UTC+6, so everything logged after 18:00 local displayed yesterday's
 *    date on the dashboard.
 *  - `new Date(x).toLocaleString()` follows the *browser's* locale and timezone.
 *    An audit log is an institutional record; it must read the same on a laptop
 *    in Dhaka and on a reviewer's machine anywhere else.
 *
 * Both are replaced by explicit `timeZone` formatting through `Intl`.
 *
 * ponytail: the zone is a constant with an env override rather than a per-row
 * institution setting — the product is Bangladesh-only and BST has no DST, so a
 * column + settings UI would buy nothing today. If EduFusionBD ever sells
 * outside UTC+6, add `institution_setting.timezone` and thread it through this
 * one module; every call site already goes through here.
 */

export const INSTITUTION_TZ = process.env.NEXT_PUBLIC_INSTITUTION_TZ ?? "Asia/Dhaka";

/** Digits-only locale so the numeral system stays under `useT().n()`'s control. */
const DATE_LOCALE = "en-GB";

/**
 * `YYYY-MM-DD` for the given instant **in institution time**.
 *
 * `en-CA` is the shortest standards-blessed route to an ISO-shaped date from
 * `Intl` — it formats as `2026-07-31` natively, so there is no part-assembly to
 * get wrong. Default argument is "now".
 */
export function localDay(value: Date | string | number = new Date()): string {
  const d = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("en-CA", { timeZone: INSTITUTION_TZ }).format(d);
}

/**
 * Hour of day (0-23) **in institution time**.
 *
 * `new Date().getHours()` is the BROWSER's hour, which is the same thing only
 * for as long as everyone using the product sits in UTC+6. The dashboard makes
 * two decisions from the clock — the greeting, and whether a section is late
 * submitting its register — and both were reading the browser. A head teacher
 * on a laptop still set to another zone got "Good evening" at breakfast and an
 * attendance alarm at dawn.
 *
 * `hourCycle: "h23"` because `hour12: false` yields "24" for midnight in some
 * ICU versions, which parses to 24 and compares wrongly against a cutoff.
 */
export function institutionHour(value: Date | string | number = new Date()): number {
  const d = value instanceof Date ? value : new Date(value);
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: INSTITUTION_TZ,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(d),
  );
}

/** Institution-local `YYYY-MM-DD` for today. The default value of every date input. */
export function today(): string {
  return localDay();
}

/** Institution-local `YYYY-MM-DD`, `n` days from now (negative = past). */
export function dayOffset(days: number, from: Date | string | number = new Date()): string {
  const base = from instanceof Date ? from : new Date(from);
  return localDay(new Date(base.getTime() + days * 86_400_000));
}

/** `31 Jul 2026` in institution time. Empty string for a null/blank input. */
export function formatDate(value: Date | string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(DATE_LOCALE, {
    timeZone: INSTITUTION_TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

/** `31 Jul 2026, 14:05` in institution time. Empty string for a null/blank input. */
export function formatDateTime(value: Date | string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(DATE_LOCALE, {
    timeZone: INSTITUTION_TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/** `Mon` — the weekday label the dashboard trend chart puts under each bar. */
export function weekdayShort(value: Date | string | number): string {
  const d = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(DATE_LOCALE, { timeZone: INSTITUTION_TZ, weekday: "short" }).format(d);
}
