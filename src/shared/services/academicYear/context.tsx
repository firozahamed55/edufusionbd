"use client";

import { useContext, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useCurrentYear, useAcademicYears } from "./hooks";
import { AcademicYearContext, ACADEMIC_YEAR_COOKIE, type AcademicYearCtx } from "./store";

/**
 * Global academic-year context (audit T-1 / B-1 — the highest-severity finding).
 *
 * The year an operator is writing to was resolved implicitly by 21 files and
 * shown nowhere, with no way to switch. During the Dec–Jan rollover that is a
 * cross-year data-corruption hazard: enter marks or promote students against
 * the wrong year and nothing in the UI tells you.
 *
 * The selection lives in a cookie, not just React state, so a server component
 * can read it too and a refresh doesn't silently snap you back to the current
 * year mid-task. Selecting a NON-current year puts the whole shell in read-only
 * mode (`isReadOnly`), which disables mutating controls rather than trusting
 * the operator to notice a label.
 */

function readCookie(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const hit = document.cookie.split("; ").find((c) => c.startsWith(`${ACADEMIC_YEAR_COOKIE}=`));
  return hit?.split("=")[1] || undefined;
}

export function AcademicYearProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data: current } = useCurrentYear();
  const { data: years = [] } = useAcademicYears();

  const cookieYearId = readCookie();
  // A cookie pointing at a deleted/other-tenant year must not silently scope
  // every query to nothing — fall back to the DB-defined current year.
  const selectedId =
    cookieYearId && years.some((y) => y.id === cookieYearId) ? cookieYearId : current?.id;

  const setYearId = useCallback(
    (id: string) => {
      // 1 year, path=/ so server components see it too. Lax: this is a UI
      // preference, never an auth decision — RLS still scopes every read.
      document.cookie = `${ACADEMIC_YEAR_COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`;
      // Every year-scoped query keys off the id, so drop the cache wholesale
      // rather than trying to enumerate which of the 21 consumers to touch.
      queryClient.invalidateQueries();
    },
    [queryClient],
  );

  const value = useMemo<AcademicYearCtx>(
    () => ({
      years,
      yearId: selectedId,
      year: years.find((y) => y.id === selectedId),
      currentYearId: current?.id,
      isReadOnly: Boolean(selectedId && current?.id && selectedId !== current.id),
      setYearId,
    }),
    [years, selectedId, current?.id, setYearId],
  );

  return <AcademicYearContext.Provider value={value}>{children}</AcademicYearContext.Provider>;
}

export function useAcademicYear(): AcademicYearCtx {
  const ctx = useContext(AcademicYearContext);
  if (!ctx) throw new Error("useAcademicYear must be used inside <AcademicYearProvider>");
  return ctx;
}

/**
 * True when the selected year is archived. Screens use this to disable save /
 * delete / process controls, so a mis-set year cannot write at all (B-1).
 */
export function useIsReadOnlyYear(): boolean {
  return useContext(AcademicYearContext)?.isReadOnly ?? false;
}
