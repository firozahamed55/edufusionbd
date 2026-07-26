"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Search / filter / sort / page state, stored in the URL instead of `useState`
 * (final_admin.md RC-4 — 0 of 56 admin screens used `useSearchParams`).
 *
 * These values are not ephemeral UI state, they are *the address of what the
 * user is looking at*. Modelled as component state there is nowhere to hand a
 * view to another screen, which is exactly how the Teacher-List → SMS
 * `?recipients=` handoff came to be silently dropped (W-1), and why nothing in
 * the product can be bookmarked, shared, restored on refresh, or saved as a
 * view (W-4).
 *
 * `router.replace` with `scroll: false`: typing in a search box must not push
 * 20 history entries or jump the page to the top on every keystroke.
 */
export function useQueryState<T extends Record<string, string | number | undefined>>(
  defaults: T,
): [T, (patch: Partial<T>) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const state = useMemo(() => {
    const out = { ...defaults };
    for (const key of Object.keys(defaults) as (keyof T)[]) {
      const raw = params.get(String(key));
      if (raw === null) continue;
      out[key] = (typeof defaults[key] === "number" ? Number(raw) : raw) as T[keyof T];
    }
    return out;
    // `defaults` is a fresh object literal on every render at most call sites;
    // depending on it would rebuild state forever. The KEYS are what matter and
    // they are static per screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const setState = useCallback(
    (patch: Partial<T>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch)) {
        // A value equal to its default is absent from the URL, so a pristine
        // list has a clean address instead of ?q=&page=1&sort=.
        if (value === undefined || value === "" || value === defaults[key]) next.delete(key);
        else next.set(key, String(value));
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    // Same reasoning as above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params, pathname, router],
  );

  return [state, setState];
}
