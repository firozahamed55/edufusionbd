"use client";

import { useEffect } from "react";

/**
 * Warn before losing unsaved work (SRA A-0.6).
 *
 * WHAT WAS THERE. `SaveBar` renders an `UnsavedDot`, and every call site passed
 * it statically — `<UnsavedDot /><span>New admission form</span>` — so the dot
 * was decoration, not a signal. Nothing warned on navigation away from a dirty
 * form, and there was no `beforeunload` handler anywhere in the product.
 *
 * WHY IT MATTERS HERE SPECIFICALLY. Student Admission is 31 fields. Marks Entry
 * for one section is 60 numeric inputs held in React state. School networks in
 * this market are intermittent and the machines are shared; a closed tab, a back
 * gesture or an expired session takes the lot. A 45-minute marks session lost
 * that way is the kind of event that ends a pilot.
 *
 * WHAT THIS COVERS AND WHAT IT DOES NOT. `beforeunload` catches tab close,
 * reload, and navigation to another origin — the browser shows its own
 * (uncustomisable) prompt. In-app `<Link>` navigation is NOT covered: the App
 * Router exposes no cancellable route-change event, and the workarounds all
 * involve patching router internals. The honest complement is autosave, which
 * `useDraft` provides for the two grid screens where the loss is largest.
 * ponytail comment retained deliberately — this is a known ceiling, not an
 * oversight.
 */
export function useUnsavedGuard(isDirty: boolean): void {
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      // Chrome requires both to show the prompt; the string is never displayed.
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);
}
