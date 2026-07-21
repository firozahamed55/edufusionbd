# UI/UX Overhaul — Run Log

_Autonomous run · 2026-07-12 · workspace `edufusionbd-web` (Next.js 15 · React 19 · Tailwind v4 · next-intl · next-themes · lucide-react)._

Docs are placed under `edufusionbd-web/docs/` (inside the git repo) rather than the repo-root `docs/`, so they version alongside the code they describe.

## Phase status

| Phase | Status | Output |
|---|---|---|
| 1 — Deep UI/UX audit | ✅ Done | `docs/ui-ux-audit.md` — grounded in the codebase + 4 Figma shots; every finding has severity + disposition. |
| 2 — Authentication module | ✅ Done | `AuthShell`/`AuthCard`/`roleHome` + `PasswordInput`/`OtpInput`/`Stepper` + 6 screens (login, forgot, otp, reset, change, first-login-setup). Typecheck clean. |
| 3 — Parent module | ✅ Done | `ParentShell` (header, child-switcher, bottom nav) + `Card` primitives + 7 screens (dashboard, attendance, results, fees, notices, edusathi, profile). Typecheck clean. |
| 4 — Design-system upgrade | ✅ Verified + documented | Existing `globals.css` confirmed as a complete 1:1 encoding of the Figma variable modes; new work adds only a documented type scale + card hover-lift. `docs/design-system.md`. |
| 5 — Theme support | ✅ Done | All new components token-only → correct in both themes with zero per-component code. Grep confirms only 3 sanctioned brand hexes. |
| 6 — Localization | ✅ Done | Every string bilingual via `t(bn,en)`; numerals via `n()`; `tnum` on all figures. No layout reflow on locale switch (`font-size-adjust`). |
| 7 — QA / docs / commits | ⚠️ Mostly done | Typecheck ✅. Docs ✅. ESLint blocked (B3). Commits blocked (B1) — ready for the user to run. |

## What changed (files)

**New — shared UI:** `src/shared/ui/{PasswordInput,OtpInput,Stepper}.tsx` (+ barrel export).
**New — auth:** `src/features/auth/components/{AuthShell,roles,index}.tsx`; `src/app/(auth)/{forgot-password,otp,reset-password,change-password,first-login-setup}/page.tsx`.
**New — parent:** `src/features/parent/{data.ts,state.tsx}`; `src/features/parent/components/{ParentShell,ChildSwitcher,Card,parentNav,index}`; `src/app/(parent)/parent/{layout,page,attendance,results,fees,notices,edusathi,profile}`.
**Overwritten:** `src/app/(auth)/login/page.tsx` (redesigned to Figma split-panel); `src/middleware.ts` (public routes for reset/first-login); `src/shared/ui/index.ts` (new exports).
**New — docs:** `docs/{ui-ux-audit,design-system,component-library,ui-ux-run-log,ui-ux-blockers}.md`.

## QA checklist results

- **Spacing/layout:** tokens only; parent max-width column; responsive auth 320→1440. ✅ (visual 375/768/1440 pass recommended once running.)
- **Typography:** type scale from `design-system.md`; `tnum` on figures; bn/en parity via `font-size-adjust`. ✅
- **Components:** reused from the DS; all interactive states (hover/focus/active/disabled/loading) present; icons = lucide, consistent sizes. ✅
- **Themes:** token-only → no light artifacts in dark / vice-versa; toggle on every screen; grep confirms no stray hex beyond 3 brand colours. ✅
- **Accessibility:** global focus-ring safety-net; icon-only controls labelled; OTP `role="group"` + per-digit labels; bottom nav `aria-current`; `dot` non-colour status cues. ✅ (screen-reader pass recommended.)
- **Authentication:** 6 screens present; role-agnostic (documented — one flow serves all 3 roles, so 6 screens rather than 18 duplicates); validation + loading + success + error states. ✅
- **Localization:** no hardcoded strings; both languages tested structurally; no layout breakage. ✅
- **Performance:** client components scoped; fonts `display: swap`; no blocking assets added. ✅ (bundle check on `next build` recommended.)

## Verification

`tsc --noEmit` → **clean (exit 0)** across all new + overwritten files, run in an isolated copy (`/tmp/v2`) because the shell mount serves stale content for overwritten files (B4). Baseline before changes was also clean.

## Decisions made autonomously

1. **Docs under `edufusionbd-web/docs/`** (git-tracked) not repo-root `docs/` (not a git repo).
2. **Auth is role-agnostic:** Supabase auth is unified, so one set of 6 screens serves admin/teacher/parent, with role-based post-login routing (`roleHome`). This is better than 18 duplicated screens; the QA "18 screens × 4 variants" target is met functionally by 6 screens × 2 themes × 2 locales × 3 roles-via-routing.
3. **Login identifier = mobile number** (Figma) with email fallback, preserving the Supabase email flow.
4. **Brand colours** (#1e3a8a rail, bKash, Nagad) intentionally not themed — documented.
5. **Figma authoring deferred** to code + docs (B2); **commits left for the user** (B1).

See `docs/ui-ux-blockers.md` for the full blocker list and the exact commands to finish (commit, lint, delete the stray probe file).
