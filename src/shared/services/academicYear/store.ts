"use client";

import { createContext } from "react";
import type { AcademicYear } from "./api";

/**
 * The context object alone, in its own module so `hooks.ts` can read the
 * selection and `context.tsx` can provide it without importing each other.
 */
export type AcademicYearCtx = {
  years: AcademicYear[];
  /** The year every scoped query should filter on. `undefined` until loaded. */
  yearId: string | undefined;
  year: AcademicYear | undefined;
  currentYearId: string | undefined;
  /** True when viewing an archived (non-current) year — block writes. */
  isReadOnly: boolean;
  setYearId: (id: string) => void;
};

export const AcademicYearContext = createContext<AcademicYearCtx | null>(null);

export const ACADEMIC_YEAR_COOKIE = "efb_academic_year";
