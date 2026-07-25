/**
 * Structured logging + error reporting — the whole observability surface.
 *
 * WHY THIS EXISTS INSTEAD OF SENTRY
 * --------------------------------
 * The audit's H-4 called for Sentry. Sentry needs a vendor account and a DSN,
 * which is the project owner's decision, not an engineering one — so shipping
 * "install Sentry" would have shipped nothing. What actually blocked production
 * readiness was narrower: *server errors were not recorded anywhere*. Next 15
 * fixes that natively with `instrumentation.ts#onRequestError`, which sees every
 * server error (RSC render, route handler, server action, middleware) with no
 * dependency at all. This module is the sink it reports to.
 *
 * Output is ONE JSON LINE per event on stdout/stderr, which every host log drain
 * (Vercel, Fly, Docker + Loki, CloudWatch) already ingests and indexes. That is
 * the platform doing the work instead of an agent doing it.
 *
 * WIRING A VENDOR LATER is a single edit: add the transport at the bottom of
 * `emit()`. Every call site already passes structured fields, so nothing else
 * changes. Do NOT scatter `Sentry.captureException` through the codebase —
 * `onRequestError` + this module is already the complete funnel.
 *
 * PII IS THE HARD CONSTRAINT. This is a school system: rows are minors, their
 * guardians' phone numbers, and their fee balances. Logs get shipped to third
 * parties, sit in retention for months, and are read by people who never had a
 * reason to see a student's name. So `emit()` scrubs by key name and this module
 * never accepts a free-form object — see `scrub()`.
 */

export type LogLevel = "info" | "warn" | "error";

/** Only scalars: an object field is how a whole student row ends up in a log. */
export type LogFields = Record<string, string | number | boolean | null | undefined>;

/**
 * Key names whose values must never reach a log line.
 *
 * Matched on the KEY, not the value, because the value is exactly what we must
 * not inspect or emit. Deliberately broad — a false redaction costs a debugging
 * round-trip; a false pass leaks a child's phone number into a vendor's
 * retention window. Bangla-side field names are romanised in this codebase
 * (`name_bn`, `mobile`), so the English patterns cover both.
 */
const REDACT = /pass|token|secret|key|auth|cookie|session|jwt|name|mobile|phone|email|dob|birth|address|nid|guardian|father|mother|amount|balance/i;

const REDACTED = "[redacted]";

export function scrub(fields: LogFields): LogFields {
  const out: LogFields = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue;
    out[k] = REDACT.test(k) ? REDACTED : v;
  }
  return out;
}

/** `window` is absent in Node, the Edge runtime, and instrumentation hooks. */
const isServer = typeof window === "undefined";

/**
 * A thrown value reduced to something safe and greppable.
 *
 * The message is kept — it is the single most useful debugging field and our own
 * errors are deliberate strings ("no institution context"). Postgres error text
 * can carry a constraint name but not row data. The stack is server-only: on the
 * client it is minified noise, and shipping it would mean shipping source maps.
 */
function describe(err: unknown): LogFields {
  if (err instanceof Error) {
    return {
      err_name: err.name,
      err_message: err.message,
      // `digest` is what Next prints on the error screen — the join key between
      // "user says they saw reference abc123" and this log line.
      digest: (err as { digest?: string }).digest,
      code: (err as { code?: string }).code,
      stack: isServer ? err.stack?.split("\n").slice(0, 12).join("\n") : undefined,
    };
  }
  return { err_name: typeof err, err_message: String(err).slice(0, 500) };
}

/**
 * `trusted` bypasses `scrub`; `fields` never does.
 *
 * The split matters: `scrub` matches on key NAME, and this module's own
 * `err_name` key contains the substring "name" — routing it through the scrubber
 * would replace every error's type with `[redacted]` and quietly destroy the
 * logs it exists to protect. Trusted keys are produced only by `describe()` in
 * this file; anything a caller hands us is untrusted by construction.
 */
function emit(level: LogLevel, event: string, trusted: LogFields, fields: LogFields): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    // Set by Vercel; lets you tell which deploy produced a line after a rollback.
    commit: isServer ? (process.env.VERCEL_GIT_COMMIT_SHA ?? null) : null,
    ...trusted,
    ...scrub(fields),
  });

  // `console` is the transport on purpose: it is the one sink that works
  // identically in Node, the Edge runtime, and the browser, and the host already
  // collects it. ADD A VENDOR TRANSPORT HERE, not at the call sites.
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

/** Something noteworthy but expected. Use sparingly — logs are not metrics. */
export function logEvent(event: string, fields: LogFields = {}): void {
  emit("info", event, {}, fields);
}

/** Something recoverable but wrong. Nothing pages on this; it explains later errors. */
export function logWarning(event: string, fields: LogFields = {}): void {
  emit("warn", event, {}, fields);
}

/**
 * An error the UI already handled — a duplicate code, a failed permission check.
 * Logged at `warn`, not `error`, so it never competes with real incidents; it is
 * what makes "the save button doesn't work" answerable without a screen share.
 */
export function logHandledError(err: unknown, where: string, fields: LogFields = {}): void {
  emit("warn", "handled_error", describe(err), { where, ...fields });
}

/**
 * Record an unhandled error. The one function that matters.
 *
 * `where` is a stable, low-cardinality string ("rsc:/admin/fee", "boundary:admin")
 * so it can be grouped and alerted on. Everything variable goes in `fields`.
 */
export function reportError(err: unknown, where: string, fields: LogFields = {}): void {
  emit("error", "unhandled_error", describe(err), { where, ...fields });
}
