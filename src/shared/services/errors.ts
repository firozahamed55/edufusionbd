"use client";

import { useCallback } from "react";
import { useT } from "@/shared/i18n/useT";
import type { Bilingual } from "@/shared/i18n/useT";
import { logHandledError } from "@/shared/services/observability";

/**
 * Turn whatever the data layer threw into something a school clerk can act on.
 *
 * Before this, every screen did `e instanceof Error ? e.message : "Save failed"`,
 * which put raw PostgREST/Postgres text in front of the operator —
 * `duplicate key value violates unique constraint "uq_student_code"` is not an
 * error message, it's a stack trace with punctuation. Worse, it leaks schema
 * names, and it is English-only in a Bangla-first product.
 *
 * Matching strategy, in order:
 *  1. `code` — SQLSTATE (`23505`) or PostgREST (`PGRST116`) when the raw
 *     PostgrestError survived. Most reliable.
 *  2. message text — because `api.ts` mostly does `throw new Error(error.message)`,
 *     which drops the code. Postgres' wording for these classes is stable.
 *  3. our own RPC `raise exception` strings, which are already deliberate.
 *
 * The original message is never shown but is always logged (see `reportError`),
 * so debuggability is unchanged.
 */

export type ErrorKind =
  | "duplicate"
  | "referenced"
  | "invalid"
  | "not_found"
  | "forbidden"
  | "session_expired"
  | "rate_limited"
  | "offline"
  | "no_tenant"
  | "unknown";

type WithCode = { code?: unknown; message?: unknown; status?: unknown };

function readCode(e: unknown): string | null {
  if (typeof e !== "object" || e === null) return null;
  const code = (e as WithCode).code;
  return typeof code === "string" ? code : null;
}

/** Supabase's `AuthApiError` carries the HTTP status; PostgrestError does not. */
function readStatus(e: unknown): number | null {
  if (typeof e !== "object" || e === null) return null;
  const status = (e as WithCode).status;
  return typeof status === "number" ? status : null;
}

export function readMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  if (typeof e === "object" && e !== null) {
    const m = (e as WithCode).message;
    if (typeof m === "string") return m;
  }
  return "";
}

/** Classify a thrown value. Exported so it can be unit-tested without React. */
export function classifyError(e: unknown): ErrorKind {
  const code = readCode(e);
  const msg = readMessage(e).toLowerCase();

  // A zod parse failure at the RPC boundary (see shared/lib/validation.ts) is
  // exactly the "some values aren't valid" case. Matched on `name` rather than
  // `instanceof ZodError` so this module keeps zero runtime dependencies — it is
  // imported by 37 screens and by the error boundaries, which must not be able
  // to fail on their own import graph. `ZodError.name` is stable across zod 3/4.
  if (e instanceof Error && e.name === "ZodError") return "invalid";

  switch (code) {
    case "23505":
      return "duplicate";
    case "23503":
      return "referenced";
    case "23502":
    case "23514":
    case "22P02":
      return "invalid";
    case "42501":
      return "forbidden";
    case "PGRST116":
      return "not_found";
    case "PGRST301":
      return "session_expired";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
    case "over_sms_send_rate_limit":
      return "rate_limited";
  }

  // Supabase Auth rate-limits /auth/v1/* by IP with a token bucket and answers
  // 429 (audit M-4). Without this branch the login screen reported that 429 as
  // "wrong password", so a throttled user kept retrying — which is precisely how
  // you keep the bucket empty and lock yourself out for longer.
  if (readStatus(e) === 429 || msg.includes("rate limit") || msg.includes("too many requests")) {
    return "rate_limited";
  }

  // Network layer: fetch rejects with a TypeError before any HTTP status exists.
  if (msg.includes("failed to fetch") || msg.includes("networkerror") || msg.includes("load failed")) {
    return "offline";
  }

  // Our own RPC guards (see the migrations) — these are already intentional.
  if (msg.includes("no institution context")) return "no_tenant";
  if (msg.includes("not authorized") || msg.includes("permission denied")) return "forbidden";
  if (msg.includes("not found in institution") || msg.includes("not found")) return "not_found";

  // Postgres wording, for the paths where only `error.message` survived.
  if (msg.includes("duplicate key value")) return "duplicate";
  if (msg.includes("violates foreign key constraint")) return "referenced";
  if (
    msg.includes("violates check constraint") ||
    msg.includes("violates not-null constraint") ||
    msg.includes("invalid input syntax")
  ) {
    return "invalid";
  }
  if (msg.includes("jwt expired") || msg.includes("invalid claim")) return "session_expired";

  return "unknown";
}

const COPY: Record<ErrorKind, Bilingual> = {
  duplicate: {
    bn: "এই তথ্য আগে থেকেই আছে — ডুপ্লিকেট এন্ট্রি করা যাবে না।",
    en: "This record already exists — duplicates aren't allowed.",
  },
  referenced: {
    bn: "এটি অন্য জায়গায় ব্যবহৃত হচ্ছে, তাই মুছে ফেলা যাবে না।",
    en: "This is in use elsewhere, so it can't be removed.",
  },
  invalid: {
    bn: "কিছু তথ্য সঠিক নয়। ঘরগুলো আবার দেখে নিন।",
    en: "Some values aren't valid. Please review the fields.",
  },
  not_found: {
    bn: "তথ্যটি খুঁজে পাওয়া যায়নি — সম্ভবত এটি মুছে ফেলা হয়েছে।",
    en: "That record could not be found — it may have been deleted.",
  },
  forbidden: {
    bn: "এই কাজটি করার অনুমতি আপনার নেই।",
    en: "You don't have permission to do this.",
  },
  session_expired: {
    bn: "আপনার সেশন শেষ হয়ে গেছে। আবার লগইন করুন।",
    en: "Your session has expired. Please sign in again.",
  },
  rate_limited: {
    bn: "অনেকবার চেষ্টা করা হয়েছে। এক মিনিট পরে আবার চেষ্টা করুন।",
    en: "Too many attempts. Please wait a minute and try again.",
  },
  offline: {
    bn: "ইন্টারনেট সংযোগ পাওয়া যাচ্ছে না। সংযোগ দেখে আবার চেষ্টা করুন।",
    en: "No connection. Check your internet and try again.",
  },
  no_tenant: {
    bn: "আপনার অ্যাকাউন্ট কোনো প্রতিষ্ঠানের সাথে যুক্ত নয়। অ্যাডমিনের সাথে যোগাযোগ করুন।",
    en: "Your account isn't linked to an institution. Contact your administrator.",
  },
  unknown: {
    bn: "কাজটি সম্পন্ন করা যায়নি। আবার চেষ্টা করুন।",
    en: "That didn't go through. Please try again.",
  },
};

/** Locale-free description — for tests, logs, and server code. */
export function describeError(e: unknown): Bilingual & { kind: ErrorKind } {
  const kind = classifyError(e);
  return { kind, ...COPY[kind] };
}

/**
 * Screen-level helper:
 *
 *   const msg = useErrorMessage();
 *   onError: (e) => toast({ title: msg(e), variant: "error" })
 *
 * Pass `fallback` when the screen has a better generic line than "that didn't
 * go through" — it is used only for `unknown`, so recognised errors always win.
 */
export function useErrorMessage() {
  const { tb, t } = useT();
  return useCallback(
    (e: unknown, fallback?: Bilingual) => {
      const { kind, bn, en } = describeError(e);
      // This is what makes the promise at the top of this file true: the operator
      // sees friendly bilingual copy, and the original PostgREST/Postgres text
      // still lands in the log — scrubbed, at `warn`, tagged with the kind we
      // classified it as (so a spike of `unknown` means this classifier needs a
      // new case, and that is now visible instead of guessed at).
      logHandledError(e, "data_layer", { kind });
      if (kind === "unknown" && fallback) return t(fallback.bn, fallback.en);
      return tb({ bn, en });
    },
    [tb, t],
  );
}
