# EduFusionBD — Web Frontend

Multi-tenant Bangladeshi school-management SaaS. **Next.js 15 (App Router) + TypeScript**, a **feature-based modular monolith** on **Supabase**, Bangla-first with light/dark theming.

> Full rationale: [`../docs/superpowers/specs/2026-07-04-edufusionbd-frontend-architecture-design.md`](../docs/superpowers/specs/2026-07-04-edufusionbd-frontend-architecture-design.md)

## Status — fully integrated ✅

All **8 admin modules / 55 screens** are wired to a **live Supabase backend** — no demo/mock data remains. Reads, writes, search/filter/sort, and loading/empty/error states are real and RLS-scoped.

- **Database:** 86 tables, **100% Row-Level Security**, 44 institution-guarded `SECURITY DEFINER` RPCs, 26 migrations. Schema lives in [`supabase/`](supabase/).
- **Data layer:** every screen goes UI → TanStack Query hook → `logic/api.ts` → Supabase RPC/query → RLS. UI files never issue SQL (enforced by ESLint boundaries).
- **Build:** `next build` green · `tsc --noEmit` clean.
- **Report:** see [`EduFusionBD_Production_Readiness.md`](EduFusionBD_Production_Readiness.md) — score **88/100**, deployment-ready for a supervised pilot.

**Modules:** Teacher · Student · Fee · Attendance · Exam · Certificate · SMS & Notice · Core Settings (+ Dashboard).
Deferred (post-pilot): PDF export, file upload, real SMS-gateway delivery, self-serve user invites, automated tests.

## Why this stack
- **Next.js** — one framework for the auth-gated app *and* a future public/SEO surface; edge middleware for auth + tenant guarding; first-class `@supabase/ssr` cookie auth; per-route code-splitting.
- **Feature-based modular monolith, not micro-frontends** — one team, one deploy. Isolation comes from strict ESLint import boundaries, not runtime federation.
- **Supabase** — Postgres + Auth + **RLS keyed on `institution_id`** (multi-tenant) + Storage + Realtime.

## Structure
```
src/
  app/            Routing only. Route groups: (auth) (admin) … + middleware (auth+tenant guard)
  features/admin/ 9 modules → 55 self-contained "micro-screen" folders
    <module>/screens/<screen>/  ← Screen.tsx + components/ hooks/ logic/ styles/ assets/ + index.ts
  shared/         design-system (tokens+theme) · ui · hooks · services (supabase, queryKeys)
                  · lib · i18n (next-intl, Bangla default) · constants (enums) · types · validation
  config/
```

### Boundaries (enforced by ESLint `boundaries/element-types`)
- `app` → `features`, `shared`, `config`
- `feature` → `shared`, `config`, **its own** subtree only (never another feature)
- `shared` → `shared`, `config` only

## Light + dark
One themed component per screen. Every color is a **semantic CSS variable** (`bg-surface`, `text-primary`, …) defined once in `app/globals.css` for `:root` (light) and `[data-theme="dark"]`. `next-themes` flips `data-theme`; both modes render from a single code path — no duplicated dark files.

## Getting started
```bash
npm install
cp .env.example .env.local   # fill Supabase keys
npm run gen:types            # generate src/shared/types/database.types.ts from Supabase
npm run dev
```

## Scripts
| Script | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js lifecycle |
| `npm run lint` | ESLint incl. layer-boundary rules |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run gen:types` | Supabase → TypeScript types |
| `scripts/scaffold-admin-screens.ps1` | Regenerate micro-screen folders from `scripts/admin-screens.manifest.json` |

## Figma collection
`scripts/admin-screens.manifest.json` is the source of truth mapping each of the 55 admin screens to its Figma light/dark node IDs (file `ITLOEUcYUUfPZ82eurKJfb`, page `Admin`). Screen bodies are collected from Figma and translated to shared UI + semantic tokens (no inline hex).
