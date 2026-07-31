"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { ZodError } from "zod";

/**
 * Structurally what this hook needs from a schema, and nothing more.
 *
 * Deliberately NOT `ZodType<Out, Def, T>`: any field using `z.preprocess`
 * (which is how this codebase bridges a form's `""` to the RPC's `null`) has an
 * *input* type of `unknown`, so binding `T` to the schema's input would type
 * every such field as `unknown` in React state. `T` is inferred from `initial`
 * instead, which is the shape the form actually holds.
 */
type Parser<Out> = {
  safeParse(value: unknown):
    | { success: true; data: Out }
    | { success: false; error: ZodError };
};

/**
 * Field-level validation bound to the `Field error` prop that already exists.
 *
 * WHY (SRA A-0.2 / F-1). `shared/ui/Form.tsx#Field` accepts `error`, renders it
 * with `role="alert"`, and stamps `aria-invalid` + `aria-describedby` onto the
 * enclosed control. It is a well-built, accessible validation primitive, and
 * **0 of 197 call sites passed it.** Screens instead gated on a boolean
 * (`f.name_bn && f.dob && …`) and, on failure, fired a toast naming no field:
 * "Please fill the required fields." On Student Admission that is 31 inputs
 * across four cards and a 4-second toast — the operator has to re-derive which
 * one is wrong. Under WCAG that fails 3.3.1 Error Identification (A) and 3.3.3
 * Error Suggestion (AA) on every form in the product.
 *
 * WHY NOT REACT HOOK FORM. The SRA suggests RHF + zodResolver, and it would be
 * the right call for a greenfield form layer. Here, 197 `<Field>` sites already
 * wrap *controlled* inputs driven by a `useState` object and an `up(k, v)`
 * setter. RHF's value is uncontrolled `register()` inputs; adopting it means
 * rewriting the state wiring of 44 screens to gain re-render performance
 * nothing currently needs. This hook keeps the existing shape and delivers the
 * actual outcome — an `error` string per field — in ~90 lines and no
 * dependency. If a marks-style grid ever profiles badly on re-renders, reach
 * for RHF *there*.
 * ponytail: one hook over one dependency + 44 rewrites.
 *
 * VALIDATION TIMING. On blur and on submit; never on the first keystroke.
 * Validating as someone types tells them their half-entered email is invalid,
 * which is true and useless. After a submit attempt every field is considered
 * touched, so nothing stays hidden once the operator has asked to save.
 */

export type FieldErrors<T> = Partial<Record<keyof T & string, string>>;

export type ZodForm<T extends Record<string, unknown>, Out> = {
  values: T;
  /** Set one field. Clears that field's error — re-checked on blur/submit. */
  setValue: <K extends keyof T & string>(key: K, value: T[K]) => void;
  /** Set several fields at once (cascading selects clearing their dependents). */
  patch: (values: Partial<T>) => void;
  /** Mark a field touched — wire to `onBlur`. */
  touch: (key: keyof T & string) => void;
  /** Errors for fields the operator has seen. Pass straight to `Field error`. */
  errors: FieldErrors<T>;
  /**
   * Validate everything and return the parsed output, or `null` if invalid.
   * Marks every field touched as a side effect, so the errors become visible.
   */
  submit: () => Out | null;
  /** True when the current values parse. Use to gate a Save button. */
  isValid: boolean;
  /** True once any value differs from the initial snapshot. */
  isDirty: boolean;
  /** Replace the values and drop all errors/touched/dirty state. */
  reset: (next?: T) => void;
  /**
   * Attach a server-side rejection to the field it belongs to, so a unique-code
   * violation lands on the code input rather than in a toast.
   */
  setServerErrors: (errors: FieldErrors<T>) => void;
};

/** zod's issue list, flattened to one message per top-level field. */
function toFieldErrors<T>(error: ZodError): FieldErrors<T> {
  const out: FieldErrors<T> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key !== "string") continue;
    // First issue wins: a field with three problems shows the first, and the
    // next appears once that one is fixed. Stacking three messages under one
    // input reads as noise.
    if (out[key as keyof T & string] === undefined) {
      out[key as keyof T & string] = issue.message;
    }
  }
  return out;
}

export function useZodForm<T extends Record<string, unknown>, Out>(
  schema: Parser<Out>,
  initial: T,
): ZodForm<T, Out> {
  const [values, setValues] = useState<T>(initial);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<FieldErrors<T>>({});
  // A ref, not state: the baseline is only ever read during a comparison, and
  // storing it in state would re-render on every reset for no visible change.
  const baseline = useRef(initial);

  const parsed = useMemo(() => schema.safeParse(values), [schema, values]);

  const allErrors = useMemo<FieldErrors<T>>(
    () => (parsed.success ? {} : toFieldErrors<T>(parsed.error)),
    [parsed],
  );

  // Only surface what the operator has actually visited — until they submit,
  // at which point everything is fair game. Server errors always show: they
  // arrived in response to a deliberate action.
  const errors = useMemo<FieldErrors<T>>(() => {
    const visible: FieldErrors<T> = { ...serverErrors };
    for (const [key, message] of Object.entries(allErrors) as [keyof T & string, string][]) {
      if (submitted || touched.has(key)) visible[key] = message;
    }
    return visible;
  }, [allErrors, touched, submitted, serverErrors]);

  const setValue = useCallback(<K extends keyof T & string>(key: K, value: T[K]) => {
    setValues((p) => ({ ...p, [key]: value }));
    // A stale server error about a value the operator is actively changing is
    // worse than no error.
    setServerErrors((p) => (p[key] === undefined ? p : { ...p, [key]: undefined }));
  }, []);

  const patch = useCallback((next: Partial<T>) => {
    setValues((p) => ({ ...p, ...next }));
  }, []);

  const touch = useCallback((key: keyof T & string) => {
    setTouched((p) => (p.has(key) ? p : new Set(p).add(key)));
  }, []);

  const submit = useCallback((): Out | null => {
    setSubmitted(true);
    const result = schema.safeParse(values);
    return result.success ? result.data : null;
  }, [schema, values]);

  const reset = useCallback((next?: T) => {
    const value = next ?? baseline.current;
    baseline.current = value;
    setValues(value);
    setTouched(new Set());
    setSubmitted(false);
    setServerErrors({});
  }, []);

  const isDirty = useMemo(
    () => Object.keys(values).some((k) => values[k] !== baseline.current[k]),
    [values],
  );

  return {
    values,
    setValue,
    patch,
    touch,
    errors,
    submit,
    isValid: parsed.success,
    isDirty,
    reset,
    setServerErrors,
  };
}
