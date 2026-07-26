"use client";

import { useCallback, useEffect, useState } from "react";

const COLLAPSE_KEY = "efb_rail_collapsed";
const PINS_KEY = "efb_rail_pins";
const MAX_PINS = 5;

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

/**
 * Rail collapse + pins, persisted in localStorage (audit N-7 / N-8).
 *
 * Read lazily on mount rather than during render: reading localStorage during
 * the first render makes the server and client markup disagree and React
 * discards the whole tree. The one-frame default is invisible and correct.
 */
export function useRailState() {
  const [collapsed, setCollapsed] = useState(false);
  const [pins, setPins] = useState<string[]>([]);

  useEffect(() => {
    setCollapsed(read(COLLAPSE_KEY, false));
    setPins(read(PINS_KEY, [] as string[]));
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, JSON.stringify(next));
      } catch {
        /* private mode — the preference just won't persist */
      }
      return next;
    });
  }, []);

  const togglePin = useCallback((key: string) => {
    setPins((p) => {
      const next = p.includes(key) ? p.filter((k) => k !== key) : [...p, key].slice(-MAX_PINS);
      try {
        window.localStorage.setItem(PINS_KEY, JSON.stringify(next));
      } catch {
        /* private mode */
      }
      return next;
    });
  }, []);

  return { collapsed, toggleCollapsed, pins, togglePin };
}
