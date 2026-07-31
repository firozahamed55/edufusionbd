"use client";

import { useCallback, useMemo, useState } from "react";
import { useQueryState } from "./useQueryState";
import { useDebouncedValue } from "./useDebouncedValue";
import type { Sort } from "@/shared/ui";

/**
 * The data-interaction contract, extracted from the Teacher Directory (SRA A-0.1).
 *
 * WHY. `shared/ui` already ships every primitive an enterprise list view needs —
 * `SortableTH`, `Pagination`, `Checkbox` with real indeterminate handling,
 * `RowActions`, `LiveRegion`, `exportCsv`, `useQueryState`, `useDebouncedValue`.
 * `teacher/screens/list/ListScreen.tsx` composes all of them and says so in its
 * own doc comment. **It was built once.** Measured across 44 implementations:
 * URL state 1, sortable columns 1, live region 1, selection 3, pagination 6.
 *
 * A school administrator's day is list work — find the 12 students in 9-A who
 * owe fees, sort by amount, select them, message their guardians, export the
 * list. Without URL state that work is unbookmarkable, unshareable, and
 * destroyed by the back button. Without a live region a screen-reader user gets
 * no signal that a filter changed the table underneath them (WCAG 4.1.3 AA,
 * failed on 43 screens).
 *
 * WHY A HOOK AND NOT A `<DataTable>`. The codebase's convention is composition
 * over configuration, and a 40-prop table is how design systems die. This owns
 * URL state, debounce, sort, page and page-aware selection; the screen still
 * owns its columns, its query and its row rendering. Nothing here knows what a
 * teacher is.
 */

export const DEFAULT_PER_PAGE = 20;

export type Selection = {
  ids: ReadonlySet<string>;
  count: number;
  has: (id: string) => boolean;
  toggle: (id: string) => void;
  /** Select/clear every row on the CURRENT page. See the note below. */
  toggleAll: () => void;
  allOnPage: boolean;
  someOnPage: boolean;
  clear: () => void;
  asArray: () => string[];
};

export type DataScreen<F extends Record<string, string>> = {
  /** Raw search box value — bind straight to the input. */
  q: string;
  /** Search value after the debounce — this is what the query should use. */
  debouncedQ: string;
  page: number;
  perPage: number;
  sort: Sort;
  filters: F;

  setQ: (value: string) => void;
  setPage: (page: number) => void;
  setSort: (sort: Sort) => void;
  setFilter: <K extends keyof F & string>(key: K, value: string) => void;
  /**
   * Several filters in one history entry. Two `setFilter` calls in one handler
   * do NOT compose — each rebuilds the query string from the same render's
   * `searchParams`, so the last one wins and the others are silently dropped.
   * Any control that applies more than one key at once (a date range behind a
   * Search button) must use this.
   */
  setFilters: (patch: Partial<F>) => void;
  /** Clear search, filters and sort, and return to page 1. */
  reset: () => void;
  /** True when anything is narrowing the view — drives a "Clear filters" affordance. */
  isFiltered: boolean;

  /** Page-aware selection. Pass the ids rendered on this page. */
  useSelection: (pageIds: string[]) => Selection;

  /** `Math.max(1, ceil(total / perPage))`. */
  pages: (total: number) => number;
  /** 1-based index of the first row on this page, for a "Showing x–y of z" label. */
  from: number;
  /** 1-based index of the last row on this page, clamped to `total`. */
  to: (total: number) => number;
};

export function useDataScreen<F extends Record<string, string>>(
  options: {
    /** Extra URL-synchronised filter keys and their defaults. */
    filters?: F;
    perPage?: number;
    debounceMs?: number;
  } = {},
): DataScreen<F> {
  const { filters: filterDefaults = {} as F, perPage = DEFAULT_PER_PAGE, debounceMs = 300 } = options;

  // One `useQueryState` for everything, so a filter change and a page reset are
  // a single history replace rather than two racing ones.
  const [state, setState] = useQueryState({
    q: "",
    page: 1,
    sortKey: "",
    sortDir: "",
    ...filterDefaults,
  } as { q: string; page: number; sortKey: string; sortDir: string } & F);

  const debouncedQ = useDebouncedValue(state.q, debounceMs);

  const sort: Sort = state.sortKey
    ? { key: state.sortKey, dir: state.sortDir === "desc" ? "desc" : "asc" }
    : null;

  const filters = useMemo(() => {
    const out = {} as F;
    for (const key of Object.keys(filterDefaults) as (keyof F & string)[]) {
      out[key] = (state as unknown as F)[key];
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // Every narrowing change resets to page 1. Without it, filtering while on
  // page 4 shows an empty table and reads as "no results".
  const setQ = useCallback((value: string) => setState({ q: value, page: 1 } as never), [setState]);
  const setPage = useCallback((page: number) => setState({ page } as never), [setState]);
  const setSort = useCallback(
    (next: Sort) => setState({ sortKey: next?.key ?? "", sortDir: next?.dir ?? "", page: 1 } as never),
    [setState],
  );
  const setFilter = useCallback(
    <K extends keyof F & string>(key: K, value: string) =>
      setState({ [key]: value, page: 1 } as never),
    [setState],
  );
  const setFilters = useCallback(
    (patch: Partial<F>) => setState({ ...patch, page: 1 } as never),
    [setState],
  );
  const reset = useCallback(() => {
    const cleared: Record<string, string | number> = { q: "", page: 1, sortKey: "", sortDir: "" };
    for (const key of Object.keys(filterDefaults)) cleared[key] = "";
    setState(cleared as never);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setState]);

  const isFiltered =
    state.q !== "" ||
    state.sortKey !== "" ||
    Object.keys(filterDefaults).some((k) => (state as unknown as F)[k as keyof F] !== filterDefaults[k as keyof F]);

  const [selected, setSelected] = useState<Set<string>>(new Set());

  /**
   * Selection spans pages, so "select all" must mean "every row on THIS page".
   * A count comparison (`selected.size === rows.length`) misreports the moment a
   * selection spans two pages — the Teacher Directory got this right and it is
   * the subtlety most worth carrying across.
   */
  const useSelection = useCallback(
    (pageIds: string[]): Selection => {
      const onPage = pageIds.filter((id) => selected.has(id)).length;
      const allOnPage = pageIds.length > 0 && onPage === pageIds.length;
      return {
        ids: selected,
        count: selected.size,
        has: (id) => selected.has(id),
        toggle: (id) =>
          setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          }),
        toggleAll: () =>
          setSelected((prev) => {
            const next = new Set(prev);
            if (allOnPage) pageIds.forEach((id) => next.delete(id));
            else pageIds.forEach((id) => next.add(id));
            return next;
          }),
        allOnPage,
        someOnPage: onPage > 0 && !allOnPage,
        clear: () => setSelected(new Set()),
        asArray: () => Array.from(selected),
      };
    },
    [selected],
  );

  return {
    q: state.q,
    debouncedQ,
    page: state.page,
    perPage,
    sort,
    filters,
    setQ,
    setPage,
    setSort,
    setFilter,
    setFilters,
    reset,
    isFiltered,
    useSelection,
    pages: (total) => Math.max(1, Math.ceil(total / perPage)),
    from: (state.page - 1) * perPage + 1,
    to: (total) => Math.min(state.page * perPage, total),
  };
}

/**
 * Search / sort / page a dataset the screen already holds.
 *
 * Several list screens fetch a whole bounded set — one section's roster, the
 * class-wise dues summary — and then render it raw. They get the same contract
 * as the server-paged screens through this, with no new queries: at section size
 * (~60 rows) filtering in the browser is correct and instant, and pretending
 * otherwise would mean a round trip per keystroke.
 *
 * NOT for unbounded data. A screen whose table only ever grows — campaign
 * history, the audit log, invoices — must page on the server, or the "export
 * all" button silently exports the first page. `fee/logic/api.ts` documents that
 * bug; do not reintroduce it here.
 */
export function applyClientList<Row>(
  rows: readonly Row[],
  view: { debouncedQ: string; sort: Sort; page: number; perPage: number },
  accessors: {
    /** Fields the search box matches against, per row. */
    search?: (row: Row) => (string | number | null | undefined)[];
    /** Sortable columns, keyed by the same `sortKey` the header uses. */
    sort?: Record<string, (row: Row) => string | number | null | undefined>;
  } = {},
): { rows: Row[]; total: number } {
  let out = rows.slice();

  const needle = view.debouncedQ.trim().toLowerCase();
  if (needle && accessors.search) {
    out = out.filter((row) =>
      accessors.search!(row).some((v) => v != null && String(v).toLowerCase().includes(needle)),
    );
  }

  const by = view.sort && accessors.sort?.[view.sort.key];
  if (by && view.sort) {
    const dir = view.sort.dir === "desc" ? -1 : 1;
    out.sort((a, b) => {
      const x = by(a), y = by(b);
      // Blanks sink regardless of direction: a column of "—" at the top is
      // never what someone sorting by that column wanted to see.
      if (x == null || x === "") return 1;
      if (y == null || y === "") return -1;
      if (typeof x === "number" && typeof y === "number") return (x - y) * dir;
      return String(x).localeCompare(String(y), undefined, { numeric: true }) * dir;
    });
  }

  const total = out.length;
  const start = (view.page - 1) * view.perPage;
  return { rows: out.slice(start, start + view.perPage), total };
}
