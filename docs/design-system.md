# EduFusionBD — Design System

_Source of truth: `src/app/globals.css` (Tailwind v4 `@theme inline`). This doc codifies the tokens and the rules that keep every screen consistent, themed, and bilingual._

## Principles

1. **Token-only styling.** Components never hardcode colour, elevation, or motion. They use semantic Tailwind utilities that resolve to CSS custom properties, so light/dark theming is automatic and free.
2. **One system, two themes.** `data-theme="light|dark"` on `<html>` (via `next-themes`, `enableSystem`) flips every token. No per-component theme code.
3. **Bilingual parity.** Bangla (Hind Siliguri) and English (Inter) render at the same apparent size via `font-size-adjust: 0.51`, so switching locale never shifts layout.
4. **Accessibility is a token, not an afterthought.** Focus rings, reduced-motion, and non-colour status cues are built into the base layer.

## Colour tokens

Raw variables use the exact names the Figma product file emits, then map to utilities via `@theme inline`.

| Utility | Token | Light | Dark |
|---|---|---|---|
| `bg-canvas` | `--color-bg-canvas` | `#fafafb` | `#0b0f18` |
| `bg-surface` | `--color-bg-surface` | `#ffffff` | `#111726` |
| `bg-surface-raised` | `--color-bg-surface-raised` | `#ffffff` | `#161d2e` |
| `bg-sunken` | `--color-bg-sunken` | `#f5f5f7` | `#0b0f18` |
| `border-border-default` | `--color-border-default` | `#ececf0` | `#232c40` |
| `border-border-strong` | `--color-border-strong` | `#e2e2e8` | `#232c40` |
| `text-text-primary` | `--color-text-primary` | `#0f172a` | `#f1f5f9` |
| `text-text-secondary` | `--color-text-secondary` | `#475569` | `#94a3b8` |
| `text-text-muted` | `--color-text-muted` | `#94a3b8` | `#64748b` |
| `bg-primary` / `text-primary` | `--color-interactive-primary` | `#4f46e5` | `#818cf8` |
| `bg-primary-hover` | `--color-interactive-primary-hover` | `#4338ca` | `#a5b4fc` |
| `bg-primary-subtle` | `--color-interactive-primary-subtle` | `#eef0ff` | `#182032` |
| `ring` | `--color-focus-ring` | `#818cf8` | `#a5b4fc` |

**Status** (each has `-fg` and `-bg`): `success`, `warning`, `danger`, `info` — e.g. `bg-success-bg text-success-fg`. Dark variants use deep, low-lightness backgrounds with light foregrounds. The parent status pills ("উপস্থিত / বকেয়া / প্রকাশিত / নতুন") and admin chips both source these.

The dark theme lifts surfaces by lightness (`surface` → `surface-raised` → `161d2e`) rather than casting shadows (per the Figma dark spec), so elevation reads correctly on a true-dark canvas.

## Elevation

Shadow utilities register against themed vars, so the same class is a soft light shadow or a deep dark shadow automatically.

| Utility | Light | Dark |
|---|---|---|
| `shadow-e1` | `0 1px 3px rgba(15,23,41,.07)` | layered `rgba(5,8,15,.24)` |
| `shadow-e2` | `0 2px 8px rgba(15,23,41,.08)` | + `0 10px 24px -6px …` |
| `shadow-e3` | `0 8px 24px -8px …` | + `0 18px 42px -6px …` |

Parent cards use `shadow-e1` (raise to `e2` on hover), auth cards `shadow-e2`, admin form cards `shadow-e3`.

## Radius & spacing

Radii use Tailwind defaults, chosen to match the Figma px values: `rounded-lg` (8px, controls), `rounded-xl` (12px), `rounded-2xl` (16px, cards), `rounded-full` (pills, avatars). Spacing is the 4px-based Tailwind scale; card padding is `p-4`–`p-4.5`, card gaps `gap-3.5`.

## Typography scale

| Role | Classes | Use |
|---|---|---|
| Brand headline | `text-[40px] font-black leading-[1.15]` | Auth rail |
| Card title (auth) | `text-2xl font-bold` | "স্বাগতম" |
| Stat figure | `text-3xl`–`text-4xl font-black tnum` | ৯৪%, ৳৩,২০০, GPA |
| Section heading | `text-lg font-bold` | Parent screen titles |
| Card heading | `text-[15px] font-semibold` | `CardHead` |
| Body | `text-sm` | Default |
| Label / meta | `text-[13px]` / `text-xs` | Field labels, captions |

`tnum` (tabular numerals) is applied to every numeric figure so Bengali/Latin digits stay column-aligned and don't reflow between locales.

## Motion

`--ease-standard`, `--ease-emphasized` + `--duration-fast|base|slow`. Interactive cards lift with `transition-all duration-200 hover:-translate-y-0.5`. All motion is disabled under `prefers-reduced-motion` by the global base rule.

## Gradients

`.grad-indigo|emerald|sky|amber` — themed brand gradients (deeper stops in dark). The parent EduSathi hero and the marksheet header use `grad-indigo` with white text.

## Iconography

**lucide-react**, one library across the whole app. Sizes: 16px (compact/inline), 18–20px (controls), 22–24px (nav/primary). Stroke weight 2 (2.4 for the active bottom-nav item). Icons inherit token colours, never raw hex.

## Sanctioned hardcoded colours (the only exceptions)

Theming is bypassed **only** for fixed brand identities, which must not change with the theme:

| Hex | Where | Why |
|---|---|---|
| `#1e3a8a` | `AuthShell` brand rail | Fixed deep-indigo brand field; stays indigo in both themes by design (Figma). |
| `#e2136e` | Fees → bKash button | Official bKash brand magenta. |
| `#ec1c24` | Fees → Nagad button | Official Nagad brand red. |

Everything else in the auth and parent modules is 100% token-driven (verified by grep — no other hex literals).
