# EduFusionBD — Institutional-Grade Engineering Audit & Optimization Master Plan

**Date:** 2026-07-25 · **Remediation:** Phase 1 (2026-07-25) · **Phases 2–4 (2026-07-25)**
**Auditor scope:** Architecture · Frontend Performance · UX · Security · Database · API · Scalability · Code Quality · Production Readiness
**Method:** Evidence-based. Every finding is backed by a measurement, a query result, a build artifact, or a reproduced exploit — not inspection alone. Items marked ✅ were applied and re-verified.
**Baseline reused:** DB architecture v2.0 (91/100), UI/UX forensic audit 2026-07-20 (70/100), auth completion 2026-07-18.

> **Status (2026-07-25):** **Phases 1–4 are complete.** Every roadmap item is now either shipped and verified, or **deliberately deferred with a written decision and a numeric trigger** (ADR-0001, ADR-0002, ADR-0003) rather than left as an open TODO. What remains open is exactly three owner actions that cannot be done from code — a dashboard toggle, an uptime monitor, and a restore rehearsal. See **§10**.
>
> **Production readiness: ~41 → ~69/100.** The remaining gap is now almost entirely *purchases and rehearsals*, not engineering.

---

## 0. Executive Summary

EduFusionBD was **a strong build with near-zero operational maturity**. Phases 1–4 closed the operability gap without touching the foundations that were already right.

| Dimension | Before | After |
|---|---|---|
| Core engineering (architecture, DB, security design, type safety) | **A− / B+** | **A−** — unchanged by design; it was already good |
| Operational maturity (testing, CI/CD, monitoring, DR) | **F** | **C+** — recording, gating and documentation exist; alerting does not |

### What Phases 2–4 changed

0. ✅ **Fixed the sluggish, janky screen-to-screen navigation the owner reported.** The client Router Cache was effectively disabled (`staleTimes.dynamic` defaults to 0, and every route here is dynamic), so *every* navigation — including returning to a screen you left seconds ago — refetched the whole RSC tree with a skeleton flashing over it. Revisits went from **150–370 ms + skeleton flash to 0 ms and 0 network requests**, verified by network trace (§9.8b).
1. ✅ **Server errors are recorded for the first time** — `instrumentation.ts#onRequestError` + a structured, PII-scrubbing logger. Caught a real error live during verification, complete with `digest` correlation (§9.5).
2. ✅ **Tests: 3 → 121**, across 11 files. Includes the auth gate's full decision table, mutation-tested.
3. ✅ **Three correctness bugs found and fixed** while implementing the performance items — two of them silent financial under-reporting (§9.7).
4. ✅ **A fake authentication screen removed** — `/otp` accepted any 6 digits and routed to the admin dashboard (§9.6). New finding, not in the original audit.
5. ✅ **zod wired at the money, bulk-destructive and billing boundaries**; the type checker immediately found two untyped call sites.
6. ✅ **First-paint round trip removed** from the two heaviest screens; auth work removed from every public route.
7. ✅ **Three ADRs + an operations runbook** — the deferred scale work is now a decision on the record with trigger thresholds, not a wish list.

### Three findings where this audit's own advice was wrong

An audit that cannot correct itself is not worth much. Phase 1 found two such cases; Phases 2–4 found three more, each caught by attempting the recommendation and measuring the result. See §9.9.

---

## 1. Scorecard

### 1.1 Audit-area scores

| Area | Before | After | Reasoning |
|---|---|---|---|
| Architecture | 82 | **84** | Boundaries still 0 violations across 247 files; `PageHeader` removed 24 copies of a duplicated block |
| Code Quality | 74 | **84** | `strict` TS, 0 `any`, 0 `@ts-ignore` retained; zod wired; 121 tests; 51 arbitrary font sizes → scale tokens |
| Security | 68 | **78** | CVE patched (Ph1); zod at trust boundaries; 429 no longer misreported as bad password; fake OTP auth removed. Held below 85 by the open M-5 toggle and no alerting |
| Database | 90 | **92** | Aggregate RPC replaces a client-side full scan; 35 migrations in VCS; advisors clean bar one owner toggle |
| API design | 78 | **85** | All growth-table lists bounded; institution-wide aggregates computed in Postgres |
| Frontend Performance | 74 | **86** | Client router cache re-enabled (revisits now 0 ms / 0 requests); prefetch+hydrate on the 2 heaviest screens; public routes skip the auth round trip |
| UX | 72 | **80** | Navigation no longer flashes a skeleton on every screen change; rate-limit and field-specific errors; `/otp` honest about being unavailable |
| Scalability | 72 | **80** | Growth-table correctness fixed; partitioning/matview decisions recorded with triggers (ADR-0002) |

### 1.2 Production-readiness scores (each /100)

| Capability | Before | After | Reasoning |
|---|---|---|---|
| Performance | 74 | **86** | Screen revisits went from 150–370 ms + skeleton flash to **0 ms, 0 requests**; one round trip removed from first paint; no full-table scans left in the client |
| Security | 68 | **78** | See above. **M-5 remains an owner toggle** |
| Reliability | 45 | **70** | Error boundaries (Ph1) + server-error capture + prefetch that degrades instead of 500ing + no fake auth path |
| Scalability | 72 | **80** | Correctness at scale fixed; scale work has triggers, not guesses |
| Testing | 15 | **55** | 121 tests / 11 files. Auth gate mutation-tested. **No browser E2E; most screens untested** |
| Monitoring | 10 | **45** | Every server + client error is recorded and greppable. **Nothing alerts. Nothing polls `/api/health`** |
| Observability | 15 | **60** | Structured JSON logs, `digest` correlation, enforced PII scrubbing. **No traces, no APM** |
| Disaster Recovery | 35 | **55** | 35/35 migrations md5-verified in VCS (Ph1) + runbook. **Restore still never rehearsed** |
| CI/CD | 5 | **70** | Blocking `typecheck → lint → test → build` + prod-dep audit. No CD/preview pipeline documented |
| Documentation | 70 | **85** | 3 ADRs + operations runbook; `supabase/README` accurate |
| **Overall** | **~41** | **~69** | Operable. Not yet observable-with-alerting |

**Why not higher.** Monitoring and DR are capped by things that are not commits: an APM vendor is a purchase, an uptime monitor is a signup, and a restore rehearsal is a scheduled exercise. Claiming 90 without them would be the kind of score inflation this document exists to avoid. ADR-0003 states the trigger for buying one.

---

## 2. What is already good — keep unchanged

The expensive-to-get-right things this project already got right. **Do not refactor them.**

- **Layered architecture, mechanically enforced.** `eslint-plugin-boundaries` with `default: disallow`. **0 violations across 247 files**, and the policy itself is now executable (`tests/architecture.test.ts`).
- **Type safety.** `strict: true`, **0 `any`**, **0 `@ts-ignore`**. Generated DB types flow end to end. Phase 2 leaned on this: adding zod schemas surfaced two loosely-typed call sites at compile time.
- **Correct RSC/client split.** Thin server pages rendering client screens — which is exactly what made H-5's prefetch a small change rather than a rewrite.
- **Database.** RLS on **86/86 tables**, 110 policies, **0 unindexed foreign keys**, policies wrap tenant helpers in `(SELECT …)`. Performance advisors report **only** 169 `unused_index` INFO notices — no structural problems.
- **Security design.** Per-request CSP nonce (no `unsafe-inline` in `script-src`, now regression-tested), full header set, middleware fail-closed in prod, role gate from the *signed* JWT, `SECURITY DEFINER` RPCs with `SET search_path TO ''` + internal tenant guards, 0 `service_role` references in client source, 0 `dangerouslySetInnerHTML`.
- **Design system.** `shared/ui` — now 24 components including `PageHeader`.

> **Do not "fix" the 47 `authenticated_security_definer_function_executable` advisories.** They are the intended design: the entire write surface is `SECURITY DEFINER` with an internal `private.current_institution_id()` guard. Revoking `authenticated` would break every write in the product.

---

## 3. Findings & roadmap — final state

Effort: S ≤½ day · M ½–2 days · L 3–5 days · XL >1 week.

### 🔴 CRITICAL — both closed

| | Finding | State |
|---|---|---|
| **C-1** | Next.js middleware auth-bypass CVE-2025-29927 | ✅ **FIXED (Ph1)** — `next` 15.1.3 → 15.5.21. Exploit header re-run again in Phase 4: **307 → /login**. `npm audit --omit=dev` → 0 vulnerabilities |
| **C-2** | Unauthenticated `SECURITY DEFINER` RPCs (verified 204 unauth) | ✅ **FIXED (Ph1)** — revoked from `PUBLIC, anon`; re-verified 404. New RPCs added since follow the same convention and were privilege-checked |

### 🟠 HIGH — all closed

| | Finding | State |
|---|---|---|
| **H-1** | No CI/CD pipeline | ✅ **FIXED (Ph1)** — `.github/workflows/ci.yml`, cheapest gate first, blocking prod-dep audit |
| **H-2** | DB schema not in version control | ✅ **FIXED (Ph1)** — now **35/35** migrations, each md5-verified byte-identical to `supabase_migrations.schema_migrations` |
| **H-3** | Testing near-zero (3 tests / 227 files) | ✅ **FIXED** — **121 tests / 11 files**. §9.5 |
| **H-4** | No error tracking / monitoring | ✅ **FIXED (recording); vendor deferred** — native `onRequestError` + structured logger. §9.5, **ADR-0003** |
| **H-5** | Serial auth → render → data round-trips | ✅ **FIXED** on the 2 heaviest screens, with a reusable helper and a hard guard. §9.8 |

### 🟡 MEDIUM — all closed or decided

| | Finding | State |
|---|---|---|
| **M-1** | Wire `zod` at trust boundaries (0 imports) | ✅ **DONE** — money, bulk-destructive and billing paths. §9.6 |
| **M-2** | Paginate growth-table lists | ✅ **DONE** — and it uncovered two silent correctness bugs. §9.7 |
| **M-3** | Reliability boundaries | ✅ **DONE (Ph1)** — admin/parent `error.tsx`, `global-error.tsx`, bilingual `not-found.tsx`; all three now report to the logger |
| **M-4** | Rate limiting on auth actions | ✅ **RESOLVED — recommendation was wrong.** An app-level limiter is unreachable here. Real fix shipped instead. §9.9 |
| **M-5** | Enable leaked-password protection | ⏳ **OWNER ACTION** — the only real standing security advisory. §10 |
| **M-6** | Trim the 88 kB middleware bundle | ✅ **RESOLVED differently — measured.** 91.5 kB confirmed; the proposed trim would break token refresh. A larger saving shipped instead. §9.9 |
| **M-7** | Map PostgREST errors to user-facing messages | ✅ **DONE** — `shared/services/errors.ts`, 37 screens; extended in Phase 2 with `rate_limited` + `ZodError` |
| **M-8** | Extract a shared `PageHeader` | ✅ **DONE** — 24 screens migrated by pure substitution. §9.8 |

### 🟢 LOW

| | Finding | State |
|---|---|---|
| **L-1** | Replace 2 raw `<img>` with `next/image` | ✅ **RESOLVED — recommendation reversed (Ph1).** They are 1-hour signed URLs into a *private* per-tenant bucket; `next/image` would cache a tenant's private asset behind a public URL |
| **L-2** | Replace arbitrary `text-[Npx]` with scale tokens | ✅ **51 of 58 done.** 7 left deliberately — they need a design call, not a regex. §9.8 |
| **L-3** | Prune the 169 unused indexes | ⏳ **DEFERRED, correctly** — must not be done blind; those indexes are what keeps the dashboard plan index-only. **ADR-0002** |
| **L-4** | Consolidate the `logic/` layout | ⏳ Open, cosmetic |

---

## 4. Scalability plan — 1k / 10k / 100k users

| Tier | State | Required work |
|---|---|---|
| **1,000** | ✅ Ready | None |
| **10,000** | ✅ **Now ready** | M-2 pagination ✅ · Supabase compute bump (ops) · Supavisor transaction-mode pooling for serverless (ops) |
| **100,000** | 📋 **Designed, deliberately not built** | Background-job/queue infra → **ADR-0001** · partitioning + dashboard snapshot table → **ADR-0002** · read replicas + CDN (ops) |

Each 100k item now has a **numeric trigger** rather than a date. The measurements behind them:

- `attendance` holds **12 rows**; `audit_log` **38**; `digital_transaction` and `sms_campaign` **0**. Partitioning today would be choosing a partition key by guesswork — and a misaligned key makes the planner *slower* than the table it replaced, at the cost of a one-way rewrite of the largest table in the schema.
- `v_dashboard_kpi` runs in **12.18 ms**, every subplan an index scan, 100% buffer hits. It also **cannot** become a materialized view: it is `security_invoker`, and a matview is not — swapping it would hand every institution's KPIs to every institution.
- `pgmq`, `pg_cron` and `pg_net` are all **available and uninstalled** — one `create extension` away, which is exactly why deferring costs nothing.
- "Bulk SMS is synchronous today" was **not accurate**: `fn_send_sms_campaign` sends nothing. There is no provider. A queue built against no provider gets its schema wrong.

---

## 5. Reference: CI pipeline

Live at `.github/workflows/ci.yml` — `npm ci → typecheck → lint --max-warnings 0 → test → build`, plus a **blocking** `npm audit --omit=dev --audit-level=high`. Locally: `npm run verify`.

`--omit=dev` is deliberate: the residual advisories are all in the ESLint tool chain (build-time, never served). **Do not add `brace-expansion` to `overrides`** — v5 breaks `minimatch@3` and silently disarms ESLint's file globbing, turning the lint gate into a no-op that still reports success. `tests/architecture.test.ts` catches it.

---

## 6. Coding standards

- **Layering:** `app → features/shared`, `features → shared + own feature`, `shared → shared`. Enforced by lint *and* by test.
- **Types:** no `any`, no `@ts-ignore`.
- **Data layer:** `logic/api.ts` (pure Supabase calls) + `logic/hooks.ts` (TanStack Query) + `screens/*`. No fetching in components.
- **Query keys** live in `shared/services/queryKeys.ts` — **never** in a `"use client"` module. A Server Component importing a key from a client module receives `undefined` and prefetches into a cache entry nothing can read. See §9.8.
- **Validation:** parse external input with zod at the RPC boundary. **Never remove a server-side check because a client-side one exists.**
- **Lists:** anything that grows with tenant size is paginated, and is filtered **in the query**, never in JS after the fetch.
- **Styling:** named scale tokens (`text-body`, `text-meta`), not arbitrary `text-[Npx]`. Page headers use `<PageHeader>`.
- **i18n:** all user-facing strings via `useT()`.
- **Logging:** `reportError` / `logHandledError` from `shared/services/observability`. Scalars only, and never a field the scrubber would need to redact.

---

## 7. Engineering TODO — final state

**Phase 1 — Security & operability floor — ✅ COMPLETE**
- [x] C-1 `next@15.5.21`, auth gate re-verified · [x] C-2 anon RPCs locked · [x] H-2 35 migrations md5-verified in VCS · [x] H-1 CI · [x] M-3 error/404 boundaries · [x] R-1 `/api/health`

**Phase 2 — Observability & safety net — ✅ COMPLETE**
- [x] H-4 Server-error capture via `onRequestError` + structured PII-scrubbing logger + all 3 boundaries reporting *(vendor APM deferred — ADR-0003)*
- [x] H-3 121 tests: auth-gate decision table (mutation-tested), error classifier, validation schemas, observability redaction, i18n numerals, prefetch guard, `Pagination`, architecture policy
- [x] M-4 Rate limiting — **corrected**: shipped 429 classification + bilingual copy + owner config. §9.9
- [x] M-1 zod at the money / bulk-destructive / billing boundaries

**Phase 3 — Performance & scale — ✅ COMPLETE**
- [x] H-5 Server-prefetch + hydrate on dashboard and teacher list, via a guarded shared helper
- [x] M-2 Paginated Delete Fees; pushed the unpaid-by-section filter into the query; replaced the digital-KPI full scan with an aggregate RPC
- [x] M-6 **Corrected**: measured the bundle, rejected the proposed trim, removed auth work from every public route instead
- [x] 🆕 **Re-enabled the client router cache** — the actual cause of the reported sluggish navigation. §9.8b
- [x] M-7 User-facing error mapping (extended with `rate_limited` + `ZodError`)

**Phase 4 — Polish & 100k-readiness — ✅ COMPLETE (built what is due; decided the rest)**
- [x] M-8 `PageHeader` across 24 screens · [x] L-2 51 of 58 font sizes tokenised (7 flagged for a design call) · [x] L-1 resolved in Ph1
- [x] Background-job/queue infra → **ADR-0001** (deferred; trigger = provider contract signed)
- [x] Partitioning + materialized dashboard views → **ADR-0002** (deferred; triggers = 50 M rows / 200 ms p95)
- [x] L-3 unused indexes → **ADR-0002** (must not be pruned blind)
- [x] Operations runbook → `docs/RUNBOOK.md`

**Phase 5 — Owner actions (cannot be done from code) — see §10**

---

## 8. Changes applied

### Phase 1

| File / target | Change |
|---|---|
| `shared/services/supabase/middleware.ts`, `middleware.ts` | `getUser()` → `getClaims()` (local ES256 verify): 167 ms → 72 ms per navigation |
| `app/(admin|parent)/…/loading.tsx` | **New** — Suspense skeletons |
| `app/globals.css` | Removed document-wide `text-rendering: optimizeLegibility` |
| `features/admin/components/AdminShell.tsx` | Hoisted `NavLink`/`SubLink` (stop sidebar remount) |
| Supabase migration | `lock_class_section_and_upload_rpcs_to_authenticated` |
| `.github/workflows/ci.yml`, `eslint.config.mjs`, `supabase/migrations/*` | CI, ESLint 9 flat config, 34 migrations materialized |
| `app/**/error.tsx`, `global-error.tsx`, `not-found.tsx`, `api/health/route.ts` | Reliability + health boundaries |

### Phases 2–4

| File / target | Change |
|---|---|
| `src/instrumentation.ts` | **New** — `onRequestError`: the server-error funnel (H-4) |
| `shared/services/observability.ts` | **New** — structured JSON logging + key-name PII scrubbing |
| `shared/services/prefetch.ts` | **New** — `prefetchQueryState` + a hard guard on invalid keys (H-5) |
| `shared/lib/validation.ts` | **New** — zod primitives mirroring the RPCs' `nullif(x,'')` convention (M-1) |
| `shared/ui/PageHeader.tsx` | **New** — replaces 24 copies of the header block (M-8) |
| `shared/services/errors.ts` | `rate_limited` + `ZodError` classification; handled errors now logged |
| `shared/services/queryKeys.ts` | `dashboard.overview`; documented server-safety requirement |
| `middleware.ts` | Public routes skip the auth round trip entirely (M-6) |
| `next.config.mjs` | `experimental.staleTimes.dynamic: 30` — re-enables the client router cache (§9.8b) |
| `app/(admin)/admin/dashboard/page.tsx`, `…/teacher/list/page.tsx` | Server prefetch + `HydrationBoundary` (H-5) |
| `app/(auth)/login/page.tsx` | 429 no longer reported as a bad password (M-4) |
| `app/(auth)/otp/page.tsx` | **Removed a fake authentication path** (new finding, §9.6) |
| `features/admin/fee/logic/api.ts` | zod on collect/mapping/delete; paginated applied fees; server-side unpaid filter; aggregate KPI RPC |
| `features/admin/student/logic/api.ts` | zod on migration + student-basic writes |
| `features/admin/sms-notice/logic/api.ts` | zod on campaign send; fixed the 0-recipient billing bug |
| Supabase migration | `add_fn_digital_transaction_stats` (md5-verified into VCS) |
| 35 screen files | `PageHeader`; 51 arbitrary font sizes → scale tokens |
| `tests/` ×4 new, `src/**/*.test.ts*` ×4 new | 3 → **121** tests |
| `docs/adr/0001…0003`, `docs/RUNBOOK.md` | **New** — decisions with triggers, and an on-call runbook |

**Verification:** `npm run verify` green — `tsc --noEmit` clean · `eslint --max-warnings 0` clean · **121/121 tests** · `next build` succeeds, 74/74 pages generated · live browser check of both prefetched screens rendering real data · auth gate + CVE exploit + health + CSP re-verified by curl · Supabase security advisors clean bar the one owner toggle; performance advisors report only `unused_index` INFO.

---

## 9. Remediation log — Phases 2–4

Everything here was **applied and verified**. Commands, plans and outputs are the evidence.

### 9.5 H-4 + H-3 — observability and the test suite

**Observability.** `src/instrumentation.ts#onRequestError` is Next 15's native equivalent of what an APM SDK installs by patching the runtime. It sees every server error — including the ones that never reach a React boundary because the response died first, which was the entire blind spot. It reports into `shared/services/observability.ts`: one JSON line per event, which every host log drain already ingests.

**It caught a real error during verification.** A transient HMR fault produced exactly the artifact it was built for:

```json
{"ts":"2026-07-25T10:38:14.971Z","level":"error","event":"unhandled_error",
 "err_name":"ReferenceError","err_message":"queryKeys is not defined",
 "digest":"2352771340","where":"render:/admin/dashboard",
 "path":"/admin/dashboard","method":"GET","router":"App Router","stack":"…"}
```

`digest` is the join key: it is what the user reads off the error screen, so "I saw reference 2352771340" is now a log query. Both error boundaries and `global-error` report through the same funnel.

**PII is enforced, not documented.** This system's rows are minors, their guardians' phone numbers and their fee balances; logs get shipped to third parties and sit in retention for months. `LogFields` accepts scalars only, and `scrub()` redacts by key name against a deliberately broad pattern. One implementation detail is load-bearing: `err_name` contains the substring `name`, so routing internal fields through the scrubber replaced **every error's type** with `[redacted]`. That regression happened, was caught, and is now pinned by a test.

**Tests: 3 → 121 across 11 files.**

| File | What it protects |
|---|---|
| `tests/middleware.test.ts` (30) | The auth gate's full decision table |
| `tests/architecture.test.ts` (6) | The layering policy, executably |
| `tests/prefetch.test.ts` (6) | The silent prefetch-key failure (§9.8) |
| `shared/services/errors.test.ts` | Error classification incl. 429 and `ZodError` |
| `shared/services/observability.test.ts` | Redaction, level routing, the `err_name` regression |
| `shared/lib/validation.test.ts` | Money/uuid/date primitives + a `PAYMENT_METHOD` drift guard |
| `shared/i18n/useT.test.tsx` | Bengali↔ASCII numeral conversion — used by all 55 screens |
| `features/admin/{fee,student}/logic/api.test.ts` | The money and bulk-destructive schemas |
| `shared/ui/Pagination.test.tsx` | Page-boundary behaviour |
| `shared/lib/useDebouncedValue.test.ts` | (pre-existing) |

**Why not Playwright.** H-3 asked for browser smokes over the three auth flows. What those would protect is one pure function: `middleware()` decides, for every request in this product, whether it is allowed and where it goes. Driving that through a real login, a real network and a real Supabase adds three sources of flake, minutes of runtime and a ~400 MB CI download — and covers the decision no better. So the decision table is tested directly.

**And it was mutation-tested, because a security test that cannot fail is decoration.** Adding `"parent"` to `ADMIN_ROLES` produced exactly one failure — *"sends a parent who reaches /admin to /parent, not to /login"* — and the change was reverted. The suite detects a real privilege escalation.

Playwright remains the right tool for "does the login *form* work end to end" and is genuinely still missing. That is why Testing scores 55, not 85.

### 9.6 M-1 — zod at the boundaries, and a fake login screen

Every write in this app is a `SECURITY DEFINER` RPC receiving one `jsonb payload` and casting fields out of it in SQL. Good design — transactional and tenant-guarded — but it puts the type check in Postgres, where a failure is a SQLSTATE string rather than a field error.

Schemas now guard the paths where a bad value costs money or data:

- **`collectPayloadSchema`** — `.strict()` catches a renamed key (`invoice_id` for `fee_invoice_id`) that `payload->>` would silently drop, posting a payment against nothing. `amountString` rejects `"1,200"` — which is how a Bangladeshi clerk types twelve hundred taka, and which reaches the DB as `invalid input syntax for type numeric`.
- **`runMigrationSchema`** — year-end promotion, the most destructive write in the product. `students.min(1)` stops an empty batch being recorded as a *completed* promotion; a source≠target refinement stops a section being promoted into itself, which passes every DB constraint and produces duplicate enrolments.
- **`sendCampaignSchema`** — **fixed a live billing bug.** `recipient_count` comes from an empty-by-default number input; `""` casts to 0 in both JS and the RPC's `nullif(...)::int`, so a campaign could be recorded as sent, bill nothing and report nothing. Now `min(1)`, with a field-specific message on the screen rather than a generic "some values aren't valid".

`ZodError` maps onto the existing `invalid` copy, matched on `.name` so `errors.ts` keeps zero runtime dependencies — it is imported by 37 screens *and* by the error boundaries, which must not be able to fail on their own import graph.

**The server-side guards were deliberately left in place.** A client-side parse is bypassable with the anon key and curl. zod here is for correctness and operator experience; RLS, the tenant guards and the CHECK constraints remain the security controls.

> **🆕 NEW FINDING (HIGH) — `/otp` was a fake authentication screen.** Not in the original audit. `onSubmit` waited 700 ms and called `router.replace(roleHome(null))`: **any six digits "succeeded"** and the user was sent to `/admin/dashboard`. The middleware caught them there and bounced them to `/login`, so this was never an auth bypass — but the screen claimed to authenticate people, and it would have *become* a bypass the moment that gate regressed. There is no SMS provider, so there was nothing to verify against. It now states honestly that OTP sign-in is unavailable, with the exact `verifyOtp` call to drop in recorded in the code. **Owner decision outstanding:** whether to also hide the "Sign in with OTP" entry point on `/login` until a provider is wired.

### 9.7 M-2 — pagination, and two silent correctness bugs

Bounding the growth-table lists turned up two failures that were **wrong**, not merely slow. Both under-reported money, which is the worst direction for a fee system to be wrong in.

1. **`fetchUnpaidBySection`** selected *every* unpaid invoice in the institution and filtered by section **in JavaScript**. PostgREST caps a response at `db-max-rows`, so once the institution had more unpaid invoices than the cap, students in the requested section could fall outside the returned page — and the screen would report them as owing nothing. A fee-collection screen that under-reports debt is a silent revenue leak. The filter is now pushed into the query with `!inner` joins, so Postgres selects and the transfer is bounded by the section's size.

2. **`fetchDigitalTransactionStats`** selected `status, amount` for every transaction and reduced in JS. Past the same ceiling the KPI tiles would show a confident total for a **partial** table with no indication anything was missing. Replaced by `fn_digital_transaction_stats` — one round trip, aggregated in Postgres, following the house pattern (`SECURITY DEFINER` + `SET search_path TO ''` + explicit tenant guard). Privileges verified: `anon=false, authenticated=true`. The migration was written to `supabase/migrations/` and **md5-verified byte-identical** (`3250b41e…`, 1487 bytes) against `supabase_migrations.schema_migrations`, per H-2's rule.

3. **`fetchAppliedFees`** (Delete Fees) is now paginated at 25. Selection deliberately survives page changes — the operator may void invoices spanning pages and the RPC takes a list — so "select all" means "all on this page" and the total is authoritative.

Already bounded and left alone: `sms_campaign` (`.limit(100)`), `audit_log`, `digital_transaction`, teacher list. Bounded by nature and left alone: per-student invoices, per-section rosters, staff lists.

### 9.8 H-5, M-6, M-8, L-2 — performance and polish

**H-5 — and the bug that would have made it worthless.** `prefetchQueryState` runs a screen's first-paint query during the render we already pay for and ships the result in the HTML, so the client hook renders on first paint with no fetch. Applied to the dashboard and the teacher list.

The first implementation was **silently broken**, and the failure mode is worth recording:

```
PREFETCH_DEBUG key= undefined isArray= false
PREFETCH_DEBUG dehydrated= [{"isArr":false,"hasData":true}]
```

The query key was exported from the `"use client"` hook module and imported by the Server Component page. **Next resolves that to a client-reference stub, so the value is `undefined` at runtime with no error.** The query ran, the data dehydrated under key `undefined`, the client hook never matched it and fetched again — the "optimisation" added a query per page load while appearing to work. The only symptom was a TanStack dev warning that named the wrong cause.

Fixed by moving keys into `shared/services/queryKeys.ts` (server-safe) and first-paint args into `logic/api.ts`. Then made unrepeatable: `prefetchQueryState` **throws** on a non-array, empty, or `undefined`-containing key, with a message naming the cause — because there is no scenario where prefetching under a broken key beats not prefetching. `tests/prefetch.test.ts` pins all four cases.

Verified live: `key=["dashboard","overview"] isArray=true`, `hasData:true`, and both screens render real data (12 students, 3 teachers, ৳4,500 collected; 3 teachers with "Showing 1-3 of 3").

**M-6 — measured, then rejected as specified.** Middleware is **91.5 kB** (the audit said 88 kB). The proposed fix — hand-rolled JWKS + WebCrypto verify to drop `@supabase/ssr` — would have **broken session refresh**, logging users out when their access token expires. That is a correctness regression traded for a few ms of edge parse time, on a path whose real cost (a ~150 ms network `getUser()`) Phase 1 had already removed.

A better saving was available in the same function: **public routes never read `claims`.** The guard is `!claims && !isPublic` and the role gate only covers `/admin` and `/parent`, so on `/login`, `/`, `/otp` and the password-reset flow the entire auth round trip — client construction, a JWKS fetch on a cold isolate, and a token refresh if the cookie was near expiry — was computed and discarded. It now returns early. Three tests assert `getClaims` is **not** called for public paths, so a silent revert fails CI. Trade-off accepted and documented: a session is not refreshed while the user sits on a public page.

**M-8 — 24 screens, byte-identical output.** All 40 copies of the breadcrumb+h1+subtitle block were *already* identical (`mt-1.5 text-h4 font-bold text-text-primary` / `mt-1 text-meta text-text-muted`, zero drift). So this prevents the inconsistency that arrives the first time somebody nudges spacing on one screen — forty places to change is forty chances to change thirty-nine. `PageHeader` deliberately has no `actions` prop: screens pairing the header with a button keep their own flex wrapper and pass `flex-1` via `className`, which made the migration a pure substitution rather than a redesign of 40 layouts. The 16 screens with bespoke wrappers were left alone — they need per-screen judgment, not a regex.

**L-2 — 51 of 58.** Mapped only what is exact or within 0.5 px: `text-[13px]`/`text-[15px]` → `text-meta`/`text-body` (exact), and `text-[12.5px]` → `text-meta` (**+0.5 px on 48 table headers** — flagged explicitly because this project has cared about Figma pixel parity; trivially revertable). The remaining 7 (`12px` ×3, `11.5px` ×3, `16px` ×1) sit between tokens and need a design decision: round them, or add a token.

*A mid-migration regex of mine briefly damaged two unrelated files that legitimately pass `subtitle={{ bn, en }}` object literals. Caught by `tsc`, repaired, and confirmed by `git diff` showing those files byte-unchanged.*

### 9.8b 🆕 NEW FINDING (HIGH) — the client router cache was disabled, so every navigation hit the server

**Reported by the owner during this pass: "toggling / going to different screens is too slow and not smooth at all."** Neither the audit nor Phase 1's `getClaims` work had found the actual cause, because both were looking at the cost of *one* request rather than at how many requests a navigation makes.

**Root cause.** Every route in this app is dynamic (`ƒ` in the build output) — the whole app sits behind a cookie-reading auth gate. Next's `experimental.staleTimes.dynamic` defaults to **`0`** (confirmed in `next/dist/server/config-shared.js`), which **effectively disables the client Router Cache for dynamic routes**. So navigating *back* to a screen you left five seconds ago discarded the cached payload and re-fetched the whole RSC tree from the server, with a `loading.tsx` skeleton flashing over it each time. Sluggish and, worse, visibly *janky* — which is exactly what "not smooth" describes.

**Measured, production build (`next start`), real sidebar clicks:**

| | Before | After |
|---|---|---|
| Revisit a screen (< 30 s) | **150–370 ms + skeleton flash**, one RSC request every time | **0 ms, 0 requests** — served from memory |
| First visit to a screen | 150–370 ms warm server render | unchanged (still a round trip, by design) |

Verified by network trace, not by feel: after the fix, clicking back to `/admin/student/registration` produced **no new `?_rsc=` request** — the most recent one was still the original visit's — and the page rendered fully and instantly.

**Fix:** `experimental.staleTimes: { dynamic: 30, static: 300 }` in `next.config.mjs`.

**Why 30 s is safe rather than a guess:** the RSC payload for these routes is the page shell plus (on prefetching pages) dehydrated query data, and the data layer *already* tolerates staleness by design — TanStack Query runs at `staleTime: 60_000`. The window is therefore strictly tighter than the staleness the app already accepts, mutations invalidate their own queries regardless of the router cache, and `router.refresh()` / sign-out clear it. It is not a way to reach a screen you are no longer authorised for: the middleware gate still runs on every real navigation.

**Also measured, and NOT fixed — reported honestly.** The *first* hit to each route in a fresh server process cost **1.5–8.3 s** (`/admin/teacher/list` worst at 8.3 s), dropping to 150–370 ms on every subsequent hit. That is per-route server-bundle load on first touch, not application code — there is no config toggle for it, and on Vercel each cold lambda pays it for the routes it serves. It is worth re-measuring on real hosting before treating it as a problem, since warm instances hide it.

**If the sluggishness was observed in `npm run dev`, that is a third, separate effect** and much the largest: the dev server *compiles* each route on first visit — measured at **2.2–5.7 s per route** in this session's logs (`✓ Compiled /admin/teacher/list in 4.6s`). Dev-mode navigation speed is not evidence about production. The `staleTimes` fix helps in dev too, but the compile cost dominates there and disappears in a build.

### 9.9 Three more findings where the audit's own advice was wrong

Phase 1 found two (§L-1 `next/image`; "fix all `npm audit` findings"). Phases 2–4 found three more.

1. **M-4 "add `@upstash/ratelimit` on auth actions."** Architecturally impossible to make effective here. Authentication is entirely client-side: the browser calls `supabase.auth.signInWithPassword` directly against `https://<project>.supabase.co/auth/v1/token`. **Nothing passes through Next**, so an app-level limiter is bypassed by anyone who skips our JS — it would have been pure theatre with a dependency and a Redis bill attached.

   The real control already exists and is on: Supabase Auth rate-limits `/auth/v1/*` per IP with a token bucket (30-request capacity, **429** on exceed), configurable via dashboard or Management API. What was genuinely broken was our *interaction* with it: the login screen reported that 429 as **"Invalid mobile number/email or password"**, so a throttled user retried harder and kept their own bucket empty. Now classified as `rate_limited` with bilingual copy ("Too many attempts. Please wait a minute."). **This matters disproportionately for schools**, where a whole staff room shares one NAT'd IP and can trip the limit at the start of a shift. The runbook carries the `PATCH .../config/auth` call to raise it.

2. **M-6 "trim the 88 kB middleware."** Measured 91.5 kB; the proposed approach would break token refresh. Replaced with a larger, safer saving. §9.8.

3. **§4 "bulk SMS and result processing are synchronous today — the key gap."** The premise is false. `fn_send_sms_campaign` inserts one row and decrements a balance; it calls no gateway, because no SMS provider exists. Result processing is a single set-based RPC. Building queue infrastructure against a non-existent provider would fix nothing and would get its schema wrong — batch size, idempotency keys and receipt callbacks are all determined by the provider's contract, and Bangladeshi gateways differ on every one. Recorded as **ADR-0001** with the full intended design and a trigger.

---

## 10. Still open, and honestly so

Three items. **None is an engineering task** — that is the point.

| | Action | Why it cannot be a commit | Effort |
|---|---|---|---|
| **M-5** | **Enable leaked-password protection** — Dashboard → Authentication → Policies | Not exposed to code or the MCP surface. It is the **only real standing security advisory** on the project | 30 s |
| **ADR-0003** | **Point an uptime monitor at `/api/health`** | Needs a third-party signup. The endpoint exists and returns 200; nothing polls it | 2 min |
| **DR** | **Rehearse a restore** from a Supabase daily backup into a scratch project | An exercise, not a code change. Backups that have never been restored are a hypothesis | 1 h |

Also deliberately deferred, with written decisions and triggers rather than open TODOs:

- **APM / alerting** → ADR-0003 (trigger: first paying customer, or an incident found by a user before us).
- **Queue infrastructure** → ADR-0001 (trigger: SMS provider contract signed).
- **Partitioning / dashboard snapshot table / index pruning** → ADR-0002 (triggers: 50 M rows, 200 ms p95).
- **Playwright E2E** for the auth *forms* — the reason Testing scores 55 rather than 85.
- **7 arbitrary font sizes** and the **`/otp` entry-point** question — both need a design call, not a code change.

### Ordered next steps

1. The three owner actions above (**~1 h 3 min total**).
2. Playwright smokes for the login form (Testing 55 → 75).
3. Roll `prefetchQueryState` out to the next heaviest screens — the helper and its guard are in place.
4. Decide the 7 remaining font sizes and whether `/otp` stays linked from `/login`.
