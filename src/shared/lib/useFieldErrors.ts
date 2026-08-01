"use client";

import { useCallback, useMemo, useState } from "react";

/**
 * The blur-then-show error pattern, extracted from `BasicConfigScreen` (audit
 * M-7's "generalise the `bind()` shape", plus A-4).
 *
 * WHAT IT REPLACES. Basic Config held a `touched` Set, derived an `errors`
 * record, and exposed a two-line `bind(key)` that spread `error` and `onBlur`
 * onto a `<Field>`. That is the right shape and it is why Basic Config is the
 * best-built form in the module — but it was one screen's private helper, so
 * the other ten either validated nothing or would have had to copy it.
 *
 * WHY IT IS NOT `useZodForm`. The two solve different halves and compose.
 * `useZodForm` owns the VALUES: it holds state, parses, and decides which
 * errors are visible. This hook owns nothing — it is given an already-computed
 * error map and answers "has the operator seen this field yet". That matters
 * for the screens `useZodForm` cannot serve: Basic Config's open jsonb
 * document is not a fixed object, and its rules are a partial map over keys
 * that may not exist. Those screens still deserve `bind()` and A-4 focus.
 *
 * WHY THE FOCUS PART LIVES HERE. WCAG 3.3.1 and 2.4.3: on a failed save the
 * toast says "fix the highlighted fields" and focus stays on the Save button,
 * so a keyboard or screen-reader user is told there is a problem and given no
 * route to it. One screen had solved that (Basic Config, by id convention);
 * putting it next to `bind()` is what makes the other ten inherit it instead
 * of each remembering.
 */

/** Every field control this hook can focus must carry `id={fieldId(key)}`. */
export const fieldId = (key: string) => `f-${key}`;

export type FieldErrorsApi<K extends string> = {
  /** Spread onto `<Field>`: `{...bind("email")}`. */
  bind: (key: K) => { error: string | undefined; onBlur: () => void };
  /** Mark one field seen. `bind` already does this on blur. */
  touch: (key: K) => void;
  /** Whether an error for this field should currently be visible. */
  isVisible: (key: K) => boolean;
  /**
   * Call on a failed save: every field becomes visible and focus moves to the
   * first invalid one, in the order given (which should be the order the
   * fields appear on screen, not the order the schema declares them).
   *
   * Returns the key it focused, or null — so a caller can fall back to a toast
   * when the failing rule belongs to no single field.
   */
  revealAll: (order: readonly K[]) => K | null;
  /** Back to nothing-seen, for a reset or a fresh dialog. */
  clear: () => void;
};

export function useFieldErrors<K extends string>(
  errors: Partial<Record<K, string>>,
): FieldErrorsApi<K> {
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set());
  const [submitted, setSubmitted] = useState(false);

  const touch = useCallback((key: K) => {
    setTouched((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
  }, []);

  const isVisible = useCallback(
    (key: K) => (submitted || touched.has(key)) && errors[key] !== undefined,
    [submitted, touched, errors],
  );

  const bind = useCallback(
    (key: K) => ({
      error: isVisible(key) ? errors[key] : undefined,
      onBlur: () => touch(key),
    }),
    [isVisible, errors, touch],
  );

  const revealAll = useCallback(
    (order: readonly K[]) => {
      setSubmitted(true);
      const first = order.find((key) => errors[key] !== undefined) ?? null;
      if (first) {
        // Queued rather than called inline: `setSubmitted` has not painted yet,
        // and on the screens that only render an input once its error is known
        // the element would not exist to receive focus.
        queueMicrotask(() => document.getElementById(fieldId(first))?.focus());
      }
      return first;
    },
    [errors],
  );

  const clear = useCallback(() => {
    setTouched(new Set());
    setSubmitted(false);
  }, []);

  return useMemo(
    () => ({ bind, touch, isVisible, revealAll, clear }),
    [bind, touch, isVisible, revealAll, clear],
  );
}
