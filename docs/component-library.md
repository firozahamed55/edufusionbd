# EduFusionBD — Component Library

Every component is token-driven (correct in light & dark) and every user-facing string is bilingual via `useT()`'s `t(bn, en)`. Numerals render per-locale via `n()`.

## Shared primitives — `@/shared/ui`

| Component | Props / variants | Notes |
|---|---|---|
| `Button` | `variant`: primary·secondary·tertiary·ghost·danger; `size`: sm·md·lg | Defaults to `type="button"`. |
| `Badge` | `tone`: neutral·primary·info·success·warning·danger; `dot` | `dot` gives a non-colour status cue (WCAG 1.4.1). |
| `StatCard` | — | Admin KPI tile. |
| `FormCard`, `Field`, `Input`, `Select`, `Textarea`, `Checkbox`, `SaveBar`, `UnsavedDot` | — | Form archetype primitives. |
| `Table` (+ `THead`/`TBody`/`TR`/`TH`/`TD`/`TableEmpty`) | — | Data tables. |
| `Pagination` | — | — |
| `Modal`, `ConfirmDialog` | — | Overlays. |
| `ToastProvider`, `useToast` | — | Transient notifications. |
| `BarChart`, `Donut` | — | Lightweight charts. |
| `Skeleton`, `Spinner`, `EmptyState`, `ErrorState` | — | Loading / empty / error states. Pass **localized** titles — the defaults are English. |
| **`PasswordInput`** ⭐ | `showLabel`, `hideLabel` + input props | Show/hide toggle; aria-labelled, `aria-pressed`. |
| **`OtpInput`** ⭐ | `length`, `value`, `onChange`, `ariaLabel` | Segmented digits: auto-advance, backspace-to-prev, arrow nav, full paste; `role="group"`, per-digit labels. |
| **`Stepper`** ⭐ | `steps`, `current` | Horizontal progress with check-on-complete; `aria-current="step"`. |

⭐ = added in this overhaul.

## Auth module — `@/features/auth/components`

| Component | Purpose |
|---|---|
| `AuthShell` | Split-panel chrome: indigo brand rail (logo, headline, 3 feature bullets, footer) + form column with always-visible language & theme switchers. Rail hidden < lg → clean single column on mobile. |
| `AuthCard` | `title` + optional `subtitle` + `children` + `footer`. One radius/elevation vocabulary for every auth screen. |
| `AuthBackLink` | "← back to sign in" row. |
| `roleHome(role)` | Post-login routing: admin/teacher → `/admin/dashboard`, parent → `/parent`, fallback admin. |

**Screens** (`src/app/(auth)/`), all bilingual × both themes, responsive 320→1440, role-agnostic (one flow serves admin/teacher/parent — Supabase auth is unified):

| Route | Screen | Key features |
|---|---|---|
| `/login` | Login | Mobile-number-or-email, show/hide password, remember-me, forgot link, OTP-login path, validation, loading/error, role-based redirect. |
| `/forgot-password` | Forgot Password | Identifier → success ("code sent") state. |
| `/otp` | OTP Verification | `OtpInput`, 30s resend countdown, verify with loading/error. |
| `/reset-password` | Reset Password | New + confirm, live strength meter, match validation, success. |
| `/change-password` | Change Password | Current + new + confirm (for signed-in users). |
| `/first-login-setup` | First-Login Setup | 3-step `Stepper` wizard (profile → password → preferences). |

## Parent module — `@/features/parent`

| Component / module | Purpose |
|---|---|
| `ParentShell` | Mobile-first column (max 460px, centered on desktop). Sticky greeting header (time-aware), bell (with unread dot) → notices, avatar → profile, child-switcher, fixed 5-item bottom tab bar with `aria-current`. |
| `ChildSwitcher` | Multi-child pills (`role="tablist"`); collapses when a guardian has one child. |
| `Card`, `CardHead`, `CardMore` | Shared parent surface card (rounded-2xl / `shadow-e1`); `href` makes it a link with hover-lift. |
| `ChildProvider` / `useActiveChild` | Active-child context; switching updates every screen in place. |
| `data.ts` | Demo children/notices + types (swap `getChildren()` for a guardian-scoped Supabase query). |

**Screens** (`src/app/(parent)/parent/`), all bilingual × both themes:

| Route | Screen | Matches Figma |
|---|---|---|
| `/parent` | Dashboard | EduSathi hero, today's attendance (%+bar), fees (due + pay), latest result (GPA), latest notice — 1:1 with the parent shot. |
| `/parent/attendance` | Attendance | Month summary (present/absent/leave), daily colour grid + legend. |
| `/parent/results` | Results & marksheet | GPA header (grad-indigo), subject-wise marks + grade badges, PDF download. |
| `/parent/fees` | Fees & money | Line-item breakdown, bKash/Nagad pay, payment history, paid state. |
| `/parent/notices` | Notices | List with new-badges + empty state. |
| `/parent/edusathi` | EduSathi AI | Bilingual/Banglish chat scaffold with suggested prompts. |
| `/parent/profile` | Profile & settings | Guardian, children list, language & theme toggles, change-password, sign-out. |

## Conventions

- **Strings:** never hardcoded — `t("বাংলা", "English")`. `EmptyState`/`ErrorState` must receive localized titles.
- **Numbers:** `n(value)` → Bengali numerals in bn, ASCII in en; wrap in `tnum` for alignment.
- **Icons:** lucide-react only.
- **Colours/elevation/motion:** tokens only (see `design-system.md`); the only hex exceptions are the three sanctioned brand colours.
