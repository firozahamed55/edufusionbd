# SRA implementation log

Execution record for `docs/SYSTEM_REQUIREMENTS_ANALYSIS.md` (EFB-SRA-2026-07-31).
One section per phase. Each entry states what landed, and — where the report's
recommendation was not followed literally — why.

Status legend: **DONE** · **PARTIAL** (what is missing is stated) · **OWNER**
(needs an account, a dashboard toggle or a contract — not an engineering task).

---

## Phase 1 — Integrity & honesty · **DONE** (code) · target 73 → 80

### Week 1 — `92f7d67`

| SRA item | Status | Note |
|---|---|---|
| `vercel.json` region `bom1` (5.6.1) | DONE | Functions ran in `iad1` while Supabase is `ap-south-1` |
| CI gates deploy (5.6.3) | DONE | `verify/rls/audit` → `migrate` → `vercel build+deploy --prebuilt` → `/api/health` smoke against `$GITHUB_SHA` |
| `supabase db push` job (5.6.4) | DONE | Runs before the app deploy on `main` |
| Delete the 7 dead controls (A-0.3) | DONE | 5 removed outright, 2 "(soon)" buttons → one info strip each |
| Teacher row-action id (A-3.1) | DONE | `?id=` is now URL-backed, so an open profile is linkable too |
| `hasSubjects` hardcoded (A-1.7) | DONE | Head-only count |
| Centralise timezone formatting (A-0.8) | DONE | `shared/lib/format.ts`, institution-time |
| Error alerting (5.6.5) | DONE | `OBSERVABILITY_ALERT_URL` — see the Sentry note below |
| `commit` in `/api/health` | Already present | Verified, not re-done |
| Deployment Protection on previews (5.6.2) | **OWNER** | Vercel dashboard checkbox. Live risk R-8 until set |
| Skew Protection | **OWNER** | Vercel dashboard |
| Log drain + uptime monitor | **OWNER** | Needs a vendor account; the endpoint and log shape are ready |

**Sentry (5.6.5).** Not installed. The report names Sentry; what it *asks for* is
that something alerts. `@sentry/nextjs` is a build plugin, three config files, a
sourcemap auth token and ~40 kB of client runtime, all to reach an endpoint
`fetch` already reaches — and it needs a DSN that does not exist. Unhandled
errors now POST the already-PII-scrubbed JSON line to `OBSERVABILITY_ALERT_URL`
(a Slack/Discord webhook, Better Stack, Axiom — the owner's choice, no code
change). If the project later wants Sentry's grouping and release UI, install
the SDK and delete `alertTransport`; the `instrumentation.ts#onRequestError`
funnel is unchanged either way.

### Week 2 — `f8bf5c8`

| SRA item | Status | Note |
|---|---|---|
| F-2 SMS recipient resolver + encoding-aware segments | DONE | Resolution and billing moved into Postgres; `recipient_count` is now an output, not an input |
| F-5 merit rank from `exam_result` + dry run | DONE | Merit promotion requires an exam; refuses while any selection is unprocessed |
| Grading-scheme range validation (A-9.1) | DONE | Overlaps, holes, inverted bands, 0–100 coverage, "nobody could pass" |
| Marks full-marks from `mark_config` (A-5.1) | DONE | subject → mark_config → 100, read-only, source stated |
| Fee idempotency + over-payment guard (A-6.1) | DONE | Partial unique index; over-payment refused up front instead of silently capped |

### Week 3 — `d6d5e3b`

| SRA item | Status | Note |
|---|---|---|
| Inline validation on the 5 highest-traffic forms (A-0.2 / F-1) | DONE | Admission (30 fields), Teacher onboarding (31), Fee collection, Marks Entry, Basic Config |
| Unsaved-changes guard (A-0.6) | PARTIAL | `beforeunload` covers tab close/reload/external nav. In-app `<Link>` is **not** covered: the App Router exposes no cancellable route-change event and every workaround patches router internals. Autosave is the complement |
| Autosave on Marks Entry + Attendance (A-0.6) | DONE | Debounced `localStorage`, keyed by the work; restore is always an explicit prompt |
| Attendance "already taken" banner (A-4.2) | DONE | Names who took it and when |
| Attendance SMS preview (A-4.5) | DONE | Message text, absentee count, segments × recipients, balance |

**React Hook Form (5.2).** Not added. §5.2 calls it the highest-value dependency
addition; A-0.2 asks for a ~25-line `useZodForm`. The two recommendations differ
and the second is the right one here: 197 `<Field>` sites already wrap
*controlled* inputs driven by a `useState` object and an `up(k, v)` setter. RHF's
value is uncontrolled `register()` inputs, so adopting it means rewriting the
state wiring of 44 screens to gain re-render performance nothing currently
needs. `shared/lib/useZodForm.ts` is ~90 lines and no dependency. If a
marks-style grid ever profiles badly, reach for RHF *there*.

### Out of scope of the SRA, found during Phase 1 — `0ec3802`

Re-running the Supabase advisors and verifying each finding against the live API
turned up an **unauthenticated cross-tenant read** the report does not contain.
`v_attendance_daily_summary`, `v_attendance_student_summary` and
`v_attendance_trend` lacked `security_invoker`, so
`GET /rest/v1/v_attendance_student_summary` returned every institution's
per-student attendance rate to anyone holding the anon key that ships in the
client bundle. Verified HTTP 200 with real rows before the fix, `[]` after.

Also closed: partitions of `attendance`/`mark` had RLS off and client SELECT
grants (latent — PostgREST omits partitions from its schema cache today, but
that is a PostgREST behaviour, not an authorization control), the trigger that
re-created that gap every academic year, and 48 `fn_*` executable by `anon`.

The last one is worth remembering: the first revoke targeted `anon` and changed
nothing, because the grant was `=X/postgres` — to **PUBLIC**, which every role
inherits. The check has to be the ACL, not the statement you ran. 8 pgTAP
assertions added (plan 40 → 48).

**The SRA's "RLS on 86/86 tables" counts parent tables.** Treat that figure as
covering the tables someone wrote a policy for, not the tables PostgREST can
address.

### Phase 1 exit criteria

| Criterion | Met |
|---|---|
| Zero dead controls | ✅ |
| Zero screens billing against operator-typed numbers | ✅ |
| Inline validation on the 5 forms | ✅ |
| CI gates production | ✅ (needs the Vercel Ignored Build Step set — OWNER) |
| Alerting live | ✅ once `OBSERVABILITY_ALERT_URL` is set — OWNER |
| Sub-100 ms server-to-DB latency | ✅ by placement (`bom1`); unmeasured until deployed |

---

## Phase 2 — The operating surface · in progress · target 80 → 86

_Updated as work lands._
