/**
 * The architecture invariant, as an executable test.
 *
 * `eslint.config.mjs` declares a 3-layer dependency policy with
 * `default: "disallow"`. That policy is the single most valuable constraint in
 * this codebase and it is expressed in a plugin DSL that has already changed
 * shape once (v5 rules -> v7 policies). A config that *parses* is not a config
 * that *enforces*: a mistyped selector silently allows everything.
 *
 * These cases lint virtual files through the real config, so a regression in
 * the DSL fails CI instead of quietly disarming the boundary.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { ESLint } from "eslint";
import path from "node:path";

const RULE = "boundaries/dependencies";
const root = path.resolve(__dirname, "..");

let eslint: ESLint;

// The first lintText() pays for loading the flat config + the TypeScript parser
// (several seconds). Do it once here rather than letting it land on — and time
// out — whichever test happens to run first.
beforeAll(async () => {
  eslint = new ESLint({ cwd: root });
  await eslint.lintText("export const warmup = 1;\n", {
    filePath: path.join(root, "src/shared/warmup.ts"),
    warnIgnored: false,
  });
}, 120_000);

/** Lint `code` as if it lived at `virtualPath`; return boundary-rule messages. */
async function boundaryErrors(virtualPath: string, code: string) {
  const [result] = await eslint.lintText(code, {
    filePath: path.join(root, virtualPath),
    warnIgnored: false,
  });
  return (result?.messages ?? []).filter((m) => m.ruleId === RULE);
}

describe("layering policy is actually enforced", () => {
  it("forbids one feature importing another feature", async () => {
    const errors = await boundaryErrors(
      "src/features/admin/probe.ts",
      `import { roleHome } from "@/features/auth/components/roles";\nexport const x = roleHome;\n`,
    );
    expect(errors).toHaveLength(1);
  });

  it("allows a feature importing its own feature", async () => {
    const errors = await boundaryErrors(
      "src/features/admin/probe.ts",
      `import { adminNav } from "@/features/admin/components/nav";\nexport const x = adminNav;\n`,
    );
    expect(errors).toHaveLength(0);
  });

  it("allows a feature importing shared", async () => {
    const errors = await boundaryErrors(
      "src/features/admin/probe.ts",
      `import { cn } from "@/shared/lib/cn";\nexport const x = cn;\n`,
    );
    expect(errors).toHaveLength(0);
  });

  it("forbids shared importing a feature (no upward dependency)", async () => {
    const errors = await boundaryErrors(
      "src/shared/probe.ts",
      `import { roleHome } from "@/features/auth/components/roles";\nexport const x = roleHome;\n`,
    );
    expect(errors).toHaveLength(1);
  });

  it("allows app importing features and shared", async () => {
    const errors = await boundaryErrors(
      "src/app/probe.ts",
      `import { roleHome } from "@/features/auth/components/roles";\nimport { cn } from "@/shared/lib/cn";\nexport const x = [roleHome, cn];\n`,
    );
    expect(errors).toHaveLength(0);
  });
});

describe("the whole tree is clean", () => {
  it("reports zero errors and zero warnings across src/", async () => {
    const results = await eslint.lintFiles(["src/**/*.{ts,tsx}"]);
    const problems = results.flatMap((r) =>
      r.messages.map((m) => `${r.filePath}:${m.line} ${m.ruleId ?? "?"} ${m.message}`),
    );
    expect(problems).toEqual([]);
  }, 120_000);
});
