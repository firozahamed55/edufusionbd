import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";
import boundaries from "eslint-plugin-boundaries";

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

/**
 * Flat config (ESLint 9). Replaces `.eslintrc.json` + `next lint`, both of which
 * are removed in Next 16 / unsupported on ESLint 9.
 *
 * The architectural invariant lives here: `boundaries/element-types` with
 * `default: "disallow"` means a new import is illegal unless a rule below
 * explicitly permits it. This is what keeps the 3-layer split honest —
 * it is a build-breaking error, not a convention.
 */
const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
      "graphify-out/**",
      "scripts/**",
      "src/shared/types/database.types.ts",
    ],
  },

  ...compat.extends("next/core-web-vitals", "next/typescript"),

  {
    plugins: { boundaries },
    settings: {
      "boundaries/include": ["src/**/*"],
      "boundaries/elements": [
        { type: "app", pattern: "src/app" },
        { type: "config", pattern: "src/config" },
        { type: "shared", pattern: "src/shared" },
        { type: "feature", pattern: "src/features/*", capture: ["feature"] },
        // Route-handler backing code (audit §3.2 "src/server/" tier — use
        // cases for writes that need validate·limit·authz·audit, not a home
        // for reads RLS already makes safe). Layered like `app`: it may pull
        // from any feature's `logic/` module rather than duplicate a schema,
        // because a use case's whole job is orchestrating existing feature
        // logic behind an HTTP boundary, not reimplementing it.
        { type: "server", pattern: "src/server" },
      ],
    },
    rules: {
      ...boundaries.configs.recommended.rules,
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          message:
            "Layering violation. app -> features/shared/config; features -> shared/config + own feature; shared -> shared/config only.",
          policies: [
            {
              from: { element: { type: "app" } },
              allow: {
                to: { element: { type: ["shared", "config", "feature", "server"] } },
              },
            },
            {
              from: { element: { type: "server" } },
              allow: {
                to: { element: { type: ["shared", "config", "feature"] } },
              },
            },
            {
              from: { element: { type: "feature" } },
              allow: {
                to: { element: { type: ["shared", "config"] } },
              },
            },
            // A feature may import its OWN feature only — the captured
            // `feature` segment on both sides must match.
            {
              from: { element: { type: "feature" } },
              allow: {
                to: {
                  element: {
                    type: "feature",
                    captured: { feature: "{{from.captured.feature}}" },
                  },
                },
              },
            },
            {
              from: { element: { type: "shared" } },
              allow: {
                to: { element: { type: ["shared", "config"] } },
              },
            },
            {
              from: { element: { type: "config" } },
              allow: {
                to: { element: { type: ["shared", "config"] } },
              },
            },
          ],
        },
      ],
    },
  },

  /**
   * Audit A-M8 — cache keys come from the factory, never from a literal.
   *
   * `shared/services/queryKeys.ts` was the documented single source of truth
   * while 89 of 106 queries wrote their key inline, so it was not one. The
   * concrete failure that makes this worth a lint rule rather than a comment:
   * `prefetchQueryState` requires the server's key to be byte-identical to the
   * hook's, and a one-character drift produces a prefetch that runs, costs a
   * query, and is silently discarded. `assertPrefetchKey` catches the
   * undefined-key case at runtime; only this catches the typo case at build.
   */
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/shared/services/queryKeys.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Property[key.name='queryKey'] > ArrayExpression",
          message:
            "Inline query keys are banned. Add the key to shared/services/queryKeys.ts and use `queryKeys.<domain>.<entry>` — see the note at the top of that file.",
        },
      ],
    },
  },

  /**
   * Design-system enforcement (final_admin.md RC-1 + §11.3).
   *
   * The design system was *defined* and not *enforced*, and the audit measured
   * exactly what that costs: `shadow-e3` — the modal/popover elevation — used
   * 95 times against 5 uses of e1+e2 combined, so the elevation scale had
   * collapsed to a single value and nothing on any screen read as raised.
   * Alongside it: two button implementations, 29 raw hex values, and 13
   * arbitrary radii.
   *
   * Documentation did not hold that line for a year. These rules make each
   * regression a build failure instead of a code-review hope.
   */
  {
    files: ["src/**/*.tsx"],
    ignores: [
      // Overlay primitives are the legitimate home of modal elevation.
      "src/shared/ui/Dialog.tsx",
      "src/shared/ui/RowActions.tsx",
      "src/shared/ui/Toast.tsx",
      "src/features/admin/components/AdminShell.tsx",
      "src/features/admin/components/AcademicYearSelector.tsx",
      "src/features/admin/core/components/CommandPalette.tsx",
      // global-error renders when the ROOT LAYOUT itself failed, so globals.css
      // is not guaranteed to be loaded and no token is available. Inline hex is
      // the only thing that can be relied on here — this is the one honest
      // exception, not an unfixed violation.
      "src/app/global-error.tsx",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/(?:^|\\s)shadow-e3(?:\\s|$)/]",
          message:
            "shadow-e3 is the MODAL elevation. A page card is shadow-e1 (raised) or a plain border (flat); a dropdown is shadow-e2. Using e3 everywhere is what collapsed the scale (final_admin.md S-1).",
        },
        {
          selector: "Literal[value=/#[0-9a-fA-F]{6}\\b/]",
          message:
            "Raw hex is banned in TSX. Add a semantic token in globals.css and use the Tailwind utility, so the value themes in dark mode instead of silently staying light (S-6).",
        },
        {
          selector: "Literal[value=/(?:^|\\s)(?:text|rounded)-\\[\\d/]",
          message:
            "Arbitrary text-[Npx] / rounded-[Npx] are banned. Use the named type scale (text-meta, text-h4, …) or the radius scale (S-6).",
        },
      ],
    },
  },

  /**
   * The named type scale, enforced (settings audit M-10 / Phase 7).
   *
   * A named scale existed — `--text-micro` 11px through `--text-h1` 40px — and
   * the Settings screens mixed it with Tailwind's defaults in the same file,
   * sometimes on adjacent lines. Two scales in one screen is not a scale.
   *
   * SCOPED TO THE SETTINGS MODULE, DELIBERATELY. There are ~170 raw font-size
   * utilities elsewhere in `src/features`, and turning them all into build
   * failures in one commit would either block the build or force a blind
   * find-and-replace across screens nobody has looked at — and `text-sm` (14px)
   * and `text-meta` (13px) are not the same size, so every substitution is a
   * visual decision, not a rename. Widen this `files` glob one module at a
   * time, as each is swept and actually looked at. A rule that lands with its
   * violations already fixed is a rule that stays on.
   */
  {
    files: ["src/features/admin/core/**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/(?:^|\\s)text-(?:xs|sm|base|lg|xl|2xl|3xl|4xl)(?:\\s|$)/]",
          message:
            "Use the named type scale (text-micro, text-meta, text-body, text-label, text-h4…), not Tailwind's default font sizes. Mixing the two is what made this module look unfinished (settings audit M-10).",
        },
      ],
    },
  },
];

export default config;
