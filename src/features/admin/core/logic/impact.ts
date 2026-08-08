"use client";

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/shared/services/supabase/client";
import { useT } from "@/shared/i18n/useT";
import { queryKeys } from "@/shared/services/queryKeys";
import type { BrowserClient } from "@/shared/services/supabase/types";

/**
 * What a delete actually costs (settings audit M-16).
 *
 * Every destructive action in Settings confirmed with a sentence naming the
 * record and nothing else — "Delete subject?" for a subject with two thousand
 * marks recorded against it. The one place it is done right is the term delete,
 * which warns about report mismatch; this generalises that.
 *
 * `blocking` distinguishes a reference that makes the delete DESTRUCTIVE from
 * one that merely makes it consequential. Enrolled students and processed
 * results are blocking; a subject-group membership is not.
 */

export type ImpactItem = { key: string; count: number; blocking: boolean };
export type Impact = { items: ImpactItem[]; blocking: boolean };

export type ImpactEntity =
  | "class"
  | "class_section"
  | "subject"
  | "subject_group"
  | "grade_scheme"
  | "academic_term";

const EMPTY: Impact = { items: [], blocking: false };

function parse(data: unknown): Impact {
  const d = (data ?? {}) as { items?: unknown[]; blocking?: boolean };
  return {
    items: (d.items ?? []).map((raw) => {
      const i = raw as Record<string, unknown>;
      return { key: String(i.key), count: Number(i.count ?? 0), blocking: Boolean(i.blocking) };
    }),
    blocking: Boolean(d.blocking),
  };
}

export async function fetchEntityImpact(s: BrowserClient, entity: ImpactEntity, id: string): Promise<Impact> {
  const { data, error } = await s.rpc("fn_entity_impact", { p_entity: entity, p_id: id });
  if (error) throw new Error(error.message);
  return parse(data);
}

export async function fetchCalendarImpact(s: BrowserClient, from: string, to: string): Promise<Impact> {
  const { data, error } = await s.rpc("fn_calendar_impact", { p_from: from, p_to: to });
  if (error) throw new Error(error.message);
  return parse(data);
}

/**
 * Fetched only while a confirm dialog is open (`enabled` on a non-null id), so
 * a table of forty rows does not make forty count queries on render.
 */
export function useEntityImpact(entity: ImpactEntity, id: string | null) {
  return useQuery({
    queryKey: queryKeys.core.entityImpact(entity, id),
    queryFn: () => fetchEntityImpact(createClient(), entity, id as string),
    enabled: !!id,
    // A count that is a minute old is still the right order of magnitude, and
    // this fires on every open of the same dialog.
    staleTime: 30_000,
  });
}

export function useCalendarImpact(from: string | null, to: string | null) {
  return useQuery({
    queryKey: queryKeys.core.calendarImpact(from, to),
    queryFn: () => fetchCalendarImpact(createClient(), from as string, to ?? (from as string)),
    enabled: !!from,
    staleTime: 30_000,
  });
}

export const emptyImpact = EMPTY;

/**
 * One bilingual label map for every impact key, so five confirm dialogs read
 * the same rather than each inventing a phrasing.
 */
export function useImpactLabel() {
  const { t, n } = useT();
  return useCallback(
    (key: string, count: number) => {
      const c = n(String(count));
      switch (key) {
        case "sections": return t(`${c}টি শাখা`, `${count} section${count === 1 ? "" : "s"}`);
        case "enrolled_students": return t(`${c} জন ভর্তি শিক্ষার্থী`, `${count} enrolled student${count === 1 ? "" : "s"}`);
        case "subject_mappings": return t(`${c}টি বিষয় ম্যাপিং`, `${count} subject mapping${count === 1 ? "" : "s"}`);
        case "class_mappings": return t(`${c}টি শ্রেণিতে যুক্ত`, `used by ${count} class${count === 1 ? "" : "es"}`);
        case "fee_mappings": return t(`${c}টি ফি ম্যাপিং`, `${count} fee mapping${count === 1 ? "" : "s"}`);
        case "attendance_records": return t(`${c}টি উপস্থিতি রেকর্ড`, `${count} attendance record${count === 1 ? "" : "s"}`);
        case "recorded_marks": return t(`${c}টি লিপিবদ্ধ নম্বর`, `${count} recorded mark${count === 1 ? "" : "s"}`);
        case "subject_groups": return t(`${c}টি বিষয় গ্রুপে`, `in ${count} subject group${count === 1 ? "" : "s"}`);
        case "exam_papers": return t(`${c}টি পরীক্ষার পত্র`, `${count} exam paper${count === 1 ? "" : "s"}`);
        case "subjects": return t(`${c}টি বিষয়`, `${count} subject${count === 1 ? "" : "s"}`);
        case "processed_results": return t(`${c}টি প্রসেস করা ফলাফল`, `${count} processed result${count === 1 ? "" : "s"}`);
        case "classes": return t(`${c}টি শ্রেণিতে ব্যবহৃত`, `used by ${count} class${count === 1 ? "" : "es"}`);
        case "exams": return t(`${c}টি পরীক্ষা`, `${count} exam${count === 1 ? "" : "s"}`);
        case "fee_invoices": return t(`${c}টি ফি চালান`, `${count} fee invoice${count === 1 ? "" : "s"}`);
        case "institution_default": return t("প্রতিষ্ঠানের ডিফল্ট স্কিম", "the institution's default scheme");
        default: return `${key}: ${c}`;
      }
    },
    [t, n],
  );
}
