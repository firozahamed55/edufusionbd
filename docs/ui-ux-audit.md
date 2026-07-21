# EduFusionBD — UI/UX Audit (Phase 1)

_Autonomous run · 2026-07-12 · reference: `.figma-shots/{login,parent}-{light,dark}.png` + current `edufusionbd-web` codebase._

## 0. Scope & method

Audited the live Next.js 15 / React 19 / Tailwind v4 codebase (`src/`, 256 files) against the four Figma reference screenshots and the enterprise bar (Linear / Stripe / Vercel / Fluent). Findings are grouped by the Phase-1 rubric. Each finding has a severity — **P0** (blocks production), **P1** (visible quality gap), **P2** (polish) — and a disposition noting where it is fixed in Phases 2–7.

The headline: **the design-system foundation is already strong.** `globals.css` is a real two-theme token system (surfaces, text, borders, interactive, status, elevation, gradients, motion) wired into Tailwind v4 `@theme inline`, with genuine accessibility care (`font-size-adjust` for bn↔en parity, a `box-shadow`-based focus safety net that survives `outline-none`, `prefers-reduced-motion`). The shared `ui/` layer (Button, Form primitives, Badge, states, Table, Dialog, Toast, Chart) is token-driven and themes for free. The gaps are **coverage**, not foundation: the **Parent module does not exist**, and **Auth is a single email/password login** that does not match the Figma split-panel / mobile-number design and is missing 5 of 6 required screens.

---

## 1. Layout & structure

| # | Finding | Sev | Disposition |
|---|---------|-----|-------------|
| 1.1 | Login is a single centered card (`grid place-items-center … max-w-sm`). Figma shows a **split-panel**: left indigo brand rail (logo, headline "এক সিস্টেমে পুরো স্কুল", 3 feature bullets, footer) + right form column with the card. | P1 | Phase 2 — `AuthShell` |
| 1.2 | No parent chrome at all. Figma parent is a **390px mobile app**: sticky greeting header, child-switcher pills, gradient hero, stacked cards, 5-item bottom tab bar. | P0 | Phase 3 — `ParentShell` |
| 1.3 | Admin shell grid (sticky rail + topbar + scroll area) is correct and responsive (off-canvas drawer < lg). No change needed. | — | Keep |
| 1.4 | Card rhythm across admin is consistent (`FormCard` = rounded-2xl / p-4.5 / shadow-e3 / gap-3.5). Parent must reuse the same radius/elevation vocabulary so the two surfaces feel like one product. | P2 | Phase 3 reuses tokens |

## 2. Typography

| # | Finding | Sev | Disposition |
|---|---------|-----|-------------|
| 2.1 | Type system is solid: Hind Siliguri (bn) + Inter (en), `font-size-adjust: 0.51` pins x-height so a given `px` looks identical in both languages → **zero layout shift on locale switch**. | — | Keep / verify on new screens |
| 2.2 | `.tnum` tabular-nums exists but is opt-in; the Figma parent stat numerals (৯৪%, ৳৩,২০০, GPA 4.83) are large and must not reflow — apply `tnum` on all parent stat figures. | P1 | Phase 3 |
| 2.3 | No explicit display/heading scale beyond Tailwind defaults. Auth headline ("স্বাগতম" ~24px, brand headline ~40px) and parent hero should use consistent sizes — codified in `design-system.md`. | P2 | Phase 4 doc |

## 3. Component audit

| # | Finding | Sev | Disposition |
|---|---------|-----|-------------|
| 3.1 | No password input with show/hide toggle; Figma login shows an eye affordance. | P1 | Phase 2 — `PasswordInput` |
| 3.2 | No OTP/segmented-code input primitive (Figma "ওটিপি দিয়ে লগইন"). | P1 | Phase 2 — `OtpInput` |
| 3.3 | No stepper/step-indicator for First-Login onboarding. | P1 | Phase 2 — `Stepper` |
| 3.4 | Icon library is standardized on **lucide-react** already (used in Form, states, AdminShell) → satisfies the "one icon library, consistent stroke/size" requirement. Continue lucide at 16/20/24. | — | Keep |
| 3.5 | `Badge` supports `dot` (non-colour status cue, WCAG 1.4.1) — reuse for parent "উপস্থিত / বকেয়া / প্রকাশিত / নতুন" pills instead of one-off chips. | P2 | Phase 3 |
| 3.6 | `EmptyState`/`ErrorState` default English titles (`"Something went wrong"`) are hardcoded — callers must pass localized copy; new screens must not rely on the default. | P1 | Phase 3 |

## 4. Interaction states

| # | Finding | Sev | Disposition |
|---|---------|-----|-------------|
| 4.1 | Login has loading + error states but **no success state** (e.g. "OTP sent"), no field-level validation. | P1 | Phase 2 |
| 4.2 | `Skeleton`/`Spinner` exist but parent data cards need dedicated skeletons (stat, list). | P1 | Phase 3 |
| 4.3 | Card hover-lift / press micro-interactions not standardized. Add a subtle `hover:-translate-y-0.5 + shadow` transition on interactive cards (respecting reduced-motion, already globally handled). | P2 | Phase 3 |
| 4.4 | OTP resend needs a countdown timer + disabled→enabled transition. | P1 | Phase 2 |

## 5. Responsiveness

| # | Finding | Sev | Disposition |
|---|---------|-----|-------------|
| 5.1 | Auth must work 320 → 1440: split-panel collapses to single column < lg, brand rail hidden < md. | P1 | Phase 2 |
| 5.2 | Parent is mobile-first; center in a 420px max column on tablet/desktop so it is usable on any viewport (not stretched). | P1 | Phase 3 |
| 5.3 | Admin already handles 320px+ via drawer. | — | Keep |

## 6. Accessibility

| # | Finding | Sev | Disposition |
|---|---------|-----|-------------|
| 6.1 | Global `:focus-visible` + input focus safety-net already meet WCAG 2.4.7/2.4.11. Maintain on all new controls. | — | Keep |
| 6.2 | New icon-only controls (bell, avatar, tab items, show/hide) need `aria-label`; bottom nav needs `aria-current`. | P1 | Phase 2/3 |
| 6.3 | OTP group needs `role="group"` + labelled digits; paste support must not trap keyboard users. | P1 | Phase 2 |
| 6.4 | Brand-rail indigo (#1e3a8a-family) vs white text ≥ 7:1 — verify contrast on the light login left panel and parent gradient hero (white on indigo) ≥ 4.5:1. | P1 | Phase 7 QA |

## 7. UX friction / cognitive load

| # | Finding | Sev | Disposition |
|---|---------|-----|-------------|
| 7.1 | Login redirects hard-coded to `/admin/dashboard`; a parent/teacher would land in the wrong app. Route by role after auth (fallback preserved). | P1 | Phase 2 |
| 7.2 | Figma login primary identifier is **mobile number (+880…)**, not email — matches how Bangladeshi parents log in. Current form is email-only. Support phone-or-email without breaking the Supabase email flow. | P1 | Phase 2 (documented trade-off) |
| 7.3 | No visible language switch on the login screen itself (only inside the app). Figma puts a বাংলা/EN toggle top-right of the auth canvas. | P1 | Phase 2 |
| 7.4 | Parent "Ask EduSathi" hero is the primary CTA — must be unmissable (gradient, full-width, top of scroll). | P2 | Phase 3 |

---

## Design tokens reverse-engineered from the Figma shots

- **Brand rail (both themes):** deep indigo field, `#1e3a8a → #1e40af`, white logo tile with indigo "E", white text, checkmark bullets in filled dark circles.
- **Auth card:** light `#ffffff` / dark `#111726`, radius ~16px, 1px border `#ececf0` / `#232c40`, soft `shadow-e2`.
- **Primary button:** light `#3538cd`-family indigo; dark lifts to periwinkle `#6d7ff5` (matches `--color-interactive-primary` dark token `#818cf8`).
- **Parent hero:** indigo gradient (`--gradient-indigo`), white text, circular sparkle avatar, send-arrow affordance.
- **Status pills:** success green `bg #dcfce7 / fg #15803d`, warning amber `bg #fef3c7 / fg #b45309`, info indigo — **already exactly the `--color-status-*` tokens**, confirming the token file was authored from this same Figma file.
- **Bottom tab bar:** 5 items, active item tinted (home shown in warm/red accent in the shot), icon + 11px label.

_Conclusion: the existing `globals.css` tokens are a faithful encoding of this Figma file. No token rewrite is required — Phases 2–3 build **on** them; Phase 4 only adds a documented type scale + a couple of missing radii/spacing aliases and the card hover-lift utility._
