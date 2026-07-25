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
];

export default config;
