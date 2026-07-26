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
];

export default config;
