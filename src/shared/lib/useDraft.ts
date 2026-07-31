"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Debounced localStorage autosave with an explicit restore prompt (SRA A-0.6).
 *
 * WHY. Marks Entry for a 60-student section is 60 numeric inputs held in React
 * state and nowhere else until Save. Attendance is the same shape. On the
 * intermittent connections and shared machines these schools actually run, a
 * dropped session takes a 45-minute entry session with it, and the operator has
 * no way to know it is gone until they look.
 *
 * WHY LOCALSTORAGE AND NOT A SERVER DRAFT. A server draft needs a table, an RPC,
 * a conflict story and a cleanup job, and it still fails in the exact case that
 * matters most — the connection being down. The browser is where the data
 * already is. ponytail: revisit only if drafts need to follow an operator
 * between devices, which is not a thing anyone has asked for.
 *
 * RESTORE IS NEVER SILENT. A draft that reapplies itself on load is worse than
 * no draft: the operator cannot tell stale data from what they just selected.
 * The hook surfaces `pending` and the screen asks.
 */

const PREFIX = "efb:draft:";
const DEBOUNCE_MS = 2_000;
/** Older than this and it is almost certainly not the session being resumed. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

type Stored<T> = { at: number; data: T };

export type Draft<T> = {
  /** A saved draft for this key that the operator has not accepted or dismissed. */
  pending: T | null;
  /** When it was written — the screen shows this so "restore?" is answerable. */
  savedAt: number | null;
  /** Take the draft. Returns it and stops offering it. */
  accept: () => T | null;
  /** Throw the draft away. */
  discard: () => void;
  /** Delete the draft — call after a successful save. */
  clear: () => void;
};

/**
 * @param key   Identifies the work, not the screen — e.g.
 *              `marks:${examId}:${sectionId}:${subjectId}`. A null key disables
 *              the hook, which is the right state before a selection is made.
 * @param value Current form state. Written `DEBOUNCE_MS` after it settles.
 * @param enabled Skip persisting while the value is meaningless (empty grid).
 */
export function useDraft<T>(key: string | null, value: T, enabled = true): Draft<T> {
  const [pending, setPending] = useState<T | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  // Which keys the operator has already answered for. Without this, discarding
  // a draft and then typing would re-offer it on the next render.
  const answered = useRef<Set<string>>(new Set());

  // Load on key change.
  useEffect(() => {
    if (!key || answered.current.has(key)) { setPending(null); setSavedAt(null); return; }
    try {
      const raw = window.localStorage.getItem(PREFIX + key);
      if (!raw) { setPending(null); setSavedAt(null); return; }
      const parsed = JSON.parse(raw) as Stored<T>;
      if (Date.now() - parsed.at > MAX_AGE_MS) {
        window.localStorage.removeItem(PREFIX + key);
        setPending(null); setSavedAt(null); return;
      }
      setPending(parsed.data);
      setSavedAt(parsed.at);
    } catch {
      // A corrupt or unreadable draft must never break the screen it was meant
      // to protect. Private-mode Safari throws on localStorage access at all.
      setPending(null); setSavedAt(null);
    }
  }, [key]);

  // Persist on a debounce.
  useEffect(() => {
    if (!key || !enabled) return;
    const id = setTimeout(() => {
      try {
        window.localStorage.setItem(PREFIX + key, JSON.stringify({ at: Date.now(), data: value } satisfies Stored<T>));
      } catch {
        // Quota exceeded or storage disabled — autosave is best-effort by
        // definition and must not surface as an error on a working form.
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [key, value, enabled]);

  const accept = useCallback(() => {
    if (key) answered.current.add(key);
    const data = pending;
    setPending(null);
    return data;
  }, [key, pending]);

  const clear = useCallback(() => {
    if (!key) return;
    answered.current.add(key);
    setPending(null);
    setSavedAt(null);
    try { window.localStorage.removeItem(PREFIX + key); } catch { /* see above */ }
  }, [key]);

  const discard = clear;

  return { pending, savedAt, accept, discard, clear };
}
