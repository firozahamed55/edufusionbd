/**
 * Query bounds — the fix for audit A-H4 ("51 of 65 queries are unbounded").
 *
 * WHY THIS EXISTS AT ALL. PostgREST caps a response at `db-max-rows` and
 * returns the truncated set with **no error**. `fee/logic/api.ts` documents the
 * bug that cost this project real correctness: the fee screen selected every
 * unpaid invoice in the institution, PostgREST silently cut the response, and
 * students past the cut were reported as owing nothing. That analysis was
 * correct and was applied to one function. It applies to all of them.
 *
 * So every list query in this codebase is bounded, and the bound falls into
 * exactly one of two shapes:
 *
 *   `pageRange(page)`  — a growing list the user pages through. Pair it with
 *                        `count: "exact"` and render `shared/ui/Pagination`.
 *
 *   `MAX_OPTIONS`      — a set the UI genuinely needs whole (a `<select>`, a
 *                        reference table). The cap is not pagination; it is a
 *                        *tripwire*, set far above the domain maximum (the
 *                        largest is 494 upazilas) so that hitting it means an
 *                        assumption broke, not that a user scrolled far.
 *
 * A query with neither is a bug waiting for the tenant that outgrows the cap.
 */

/** Rows per page for user-facing lists. Matches `Pagination`'s default. */
export const PAGE_SIZE = 25;

/**
 * `.range()` arguments for a 1-based page number.
 *
 * ```ts
 * const [from, to] = pageRange(page);
 * query.range(from, to);
 * ```
 */
export function pageRange(page: number, size: number = PAGE_SIZE): [number, number] {
  const p = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const from = (p - 1) * size;
  return [from, from + size - 1];
}

/** Total pages for a row count, never less than 1 (an empty list is page 1 of 1). */
export function pageCount(total: number, size: number = PAGE_SIZE): number {
  return Math.max(1, Math.ceil((total || 0) / size));
}

/** A page of rows plus the unfiltered total, as returned by `count: "exact"`. */
export type Paged<T> = { rows: T[]; total: number };

/**
 * Ceiling for "give me the whole set" queries — dropdown options and reference
 * tables. 1000 is ~2× the largest real set (494 upazilas) and well inside any
 * sane `db-max-rows`, so the bound is explicit in our code rather than implicit
 * in someone's PostgREST config.
 */
export const MAX_OPTIONS = 1000;
