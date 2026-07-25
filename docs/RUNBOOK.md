# EduFusionBD — Operations Runbook

For whoever is holding the pager. Assumes no prior context on this codebase.

**Stack:** Next 15 (App Router) on Vercel · Supabase Postgres + Auth + Storage, project `dkumhtrrgsuwxucgncix`, region `ap-south-1` (Mumbai).

---

## 1. Is it up?

```bash
curl -s https://<host>/api/health
```

`{"status":"ok","commit":"<sha>","env":"production","time":"..."}` → the web tier is serving.

This probe is **deliberately shallow**: it does not touch Postgres. A DB blip must not page you for a web tier that is fine, and an uptime monitor must not become a traffic source. Supabase reports its own availability separately. `/api/health` is excluded from the middleware matcher, so it does no JWT work — a 200 here with a broken app means auth or the DB, not the deploy.

`commit` tells you **which build answered**, which is the first question after any rollback.

> ⚠️ Nothing polls this yet. Pointing an external monitor (Better Stack, Pingdom, UptimeRobot — any of them) at this URL is the single highest-value operational task outstanding. See ADR-0003.

---

## 2. Finding an error a user reported

Users see a **Reference** code on the error screen. That is Next's `digest`, and it is the join key.

```
# In the host's log drain:
digest="<the code the user read out>"
```

You will find up to two lines for it:

| `event` | `where` | Meaning |
|---|---|---|
| `unhandled_error` | `rsc:/admin/...`, `route:/api/...` | Server-side. From `src/instrumentation.ts`. |
| `unhandled_error` | `boundary:admin` / `boundary:parent` / `boundary:root` | The client boundary that rendered the screen. |
| `handled_error` | `data_layer` | An error the UI already showed friendly copy for. `warn`, not `error`. |

Every line is one JSON object: `ts`, `level`, `event`, `commit`, `where`, `err_name`, `err_message`, `digest`, `code`, and (server only) a 12-frame `stack`.

**`boundary:root` is the serious one.** It means the root layout itself failed — no theme, no i18n, no design system. Treat it as a total outage of that route.

### Why a field says `[redacted]`

`observability.ts` scrubs by key name (names, phone numbers, emails, dates of birth, amounts, tokens). That is intentional and not a bug to work around — this system's rows are minors. If you need the value, reproduce with a test tenant; do not widen the scrubber to chase one incident.

---

## 3. Common failures

### Everyone is bounced to `/login`

The middleware is the auth gate (`src/middleware.ts`). It **fails closed in production**: if `NEXT_PUBLIC_SUPABASE_URL` is missing, every non-public route redirects to `/login`. A deploy that dropped an env var looks exactly like this.

```bash
# 1. Confirm the env var is present in the Vercel project (not just in .env.local).
# 2. Confirm Supabase Auth is up:
curl -s https://dkumhtrrgsuwxucgncix.supabase.co/auth/v1/settings | head -c 200
```

`tests/middleware.test.ts` encodes the full intended decision table — read it to confirm what *should* happen before changing anything.

### A user is told their password is wrong, but it isn't

Supabase Auth rate-limits `/auth/v1/*` per IP with a token bucket (30-request capacity) and answers **429**. A whole school behind one NAT'd IP can trip this at the start of a shift.

The login screen distinguishes 429 from a bad password (`classifyError` → `rate_limited`) and says "Too many attempts. Please wait a minute." If a user reports the *credentials* message instead, it is genuinely the wrong password.

To raise the limits: **Dashboard → Authentication → Rate Limits**, or

```bash
curl -X PATCH "https://api.supabase.com/v1/projects/dkumhtrrgsuwxucgncix/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"rate_limit_otp": 30, "rate_limit_verify": 60}'
```

### A write fails with "You don't have permission to do this"

`forbidden` = SQLSTATE `42501` or an RPC's own guard. Two likely causes:

1. The user's `app_metadata.role` is unset or wrong — the middleware treats a role-less session as unprivileged (by design; verified by test).
2. `private.current_institution_id()` returns NULL for them, i.e. the account is not linked to an institution. The UI says exactly that (`no_tenant`).

### "Something went wrong" on one screen only

The error boundary is segment-scoped: the shell survives and **Try again** re-renders just that screen. Get the Reference code before they retry.

---

## 4. Database

```bash
npm run db:diff      # what has drifted between the repo and the linked project
npm run db:pull      # pull remote schema into supabase/migrations/
```

**Every schema change lands as a file in `supabase/migrations/` and goes through PR review.** All 35 migrations are in version control and were verified byte-identical to what the remote project recorded (md5 of each file vs `md5(statements[1])` from `supabase_migrations.schema_migrations`). That verification is the DR story — do not break it by applying a change only in the dashboard.

Health check after any DDL:

```
Supabase MCP: get_advisors(type: "security")   # RLS gaps, exposed functions
Supabase MCP: get_advisors(type: "performance") # unindexed FKs, unused indexes
```

Expect exactly one standing WARN — `auth_leaked_password_protection` — until the owner enables it (§5), plus 47 `authenticated_security_definer_function_executable` warnings which are **by design**: the entire write surface is `SECURITY DEFINER` with `SET search_path TO ''` and an internal tenant guard. Do not "fix" those by revoking `authenticated`; it would break every write in the product.

Backups: Supabase daily automated. **A restore has never been rehearsed** — that is an open DR gap, not a solved one.

---

## 5. Owner-only actions (not reachable from code)

1. **Enable leaked-password protection** — Dashboard → Authentication → Policies. One toggle, 30 seconds, clears the only real standing security advisory. (Audit M-5.)
2. **Point an uptime monitor at `/api/health`.** (ADR-0003.)
3. **Review auth rate limits** for a school-network access pattern (many users, one IP). (§3.)

---

## 6. Deploys

CI (`.github/workflows/ci.yml`) gates every PR: `typecheck` → `lint --max-warnings 0` → `test` → `build`, plus a **blocking** `npm audit --omit=dev --audit-level=high`.

Locally, the same gate:

```bash
npm run verify
```

Rollback is a Vercel redeploy of the previous build. Confirm with `/api/health`'s `commit` field afterwards.

**Do not add `brace-expansion` to `package.json#overrides`.** v5 breaks `minimatch@3` (`expand is not a function`) and silently disarms ESLint's file globbing — the lint gate would pass while checking nothing. `tests/architecture.test.ts` catches it; the trap is documented in `package.json`.
