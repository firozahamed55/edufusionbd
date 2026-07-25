# ADR-0003 — Observability: native `onRequestError` + structured logs, not a vendor APM (yet)

**Status:** Accepted · **Date:** 2026-07-25 · **Implements:** ENGINEERING_AUDIT H-4.

## Context

H-4 ("no error tracking / monitoring", score 10/100) called for Sentry. Sentry requires an account, a DSN, and a spend decision — all the project owner's, none of them an engineering choice. Shipping "install Sentry" as the fix would have shipped nothing, and the actual gap was narrower and fixable today:

**server errors were recorded nowhere.** `error.tsx` only catches errors that reach the client React tree. A 500 in a Server Component, a route handler, or middleware produced no artifact at all — the failure mode where you learn about an outage from a phone call.

## Decision

Close the recording gap with the platform, and leave the vendor decision open.

1. **`src/instrumentation.ts` → `onRequestError`.** Next 15 exposes the same funnel an APM SDK installs by patching the runtime. Every server-side error arrives here, tagged with the low-cardinality `routeType:routePath` for grouping. Zero dependencies.
2. **`src/shared/services/observability.ts`** — one JSON line per event on stdout/stderr. Every host log drain (Vercel, Docker + Loki, CloudWatch) already ingests and indexes that.
3. **All three error boundaries report through it** (`boundary:admin`, `boundary:parent`, `boundary:root`), so a user-visible error screen and its server log line share Next's `digest`. "I saw reference `abc123`" is now a log query.
4. **Handled data-layer errors log at `warn`** via `logHandledError`, so the friendly bilingual copy in `errors.ts` no longer costs the raw PostgREST text. A spike in `kind=unknown` means the classifier needs a new case — previously invisible.

### PII is the hard constraint, and it is enforced in code

This is a school system: the rows are minors, their guardians' phone numbers, and their fee balances. Logs get shipped to third parties and sit in retention for months.

- `LogFields` accepts **scalars only** — an object field is how a whole student row ends up in a log.
- `scrub()` redacts by key name against a deliberately broad pattern (`name|mobile|phone|email|dob|address|nid|guardian|amount|balance|token|secret|...`). A false redaction costs one debugging round trip; a false pass leaks a child's phone number.
- Trusted internal fields bypass the scrubber, and that split is load-bearing: `err_name` contains the substring `name`, so routing it through `scrub` replaced every error's type with `[redacted]`. That regression happened during implementation and is now pinned by a test.

## Wiring a vendor later

One edit, in `emit()`. Every call site already passes structured fields. **Do not** scatter `Sentry.captureException` through the codebase — `onRequestError` plus this module is already the complete funnel, and a second funnel is how you get duplicate alerts and one path that misses errors.

## What this does NOT provide

Honest list, because a half-solution sold as a whole one is worse than the gap:

- **No alerting.** Nothing pages anyone. Errors are queryable, not pushed.
- **No aggregation, dedup, or regression detection** ("new in this release").
- **No traces, no performance monitoring.**
- **No uptime checks.** `/api/health` exists and returns 200; nothing polls it. Pointing any external monitor at it is a 2-minute task and the highest-value next step.

Score movement is therefore real but partial: Monitoring 10 → 45, Observability 15 → 60. Reaching 90 needs a vendor, and that is a purchase, not a commit.

## Trigger for revisiting

Buy an APM when **any** of: the first paying customer goes live; a production incident is discovered by a user rather than by us; or engineering headcount exceeds 2 (at which point "grep the log drain" stops scaling).
