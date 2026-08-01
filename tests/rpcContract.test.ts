/**
 * Every `.rpc("fn_…")` the client calls must exist in the database.
 *
 * WHY THIS EXISTS. The Academic Calendar screen shipped calling six RPCs —
 * `fn_calendar_range`, `fn_calendar_day`, `fn_set_calendar_range`,
 * `fn_clear_calendar_range`, `fn_upsert_academic_term`,
 * `fn_delete_academic_term` — none of which existed in the deployed database.
 * The migration that creates them was in the repository and its DDL never
 * reached the project. Every call returned a PostgREST 404, the screen rendered
 * its ErrorState, and `academic_calendar` sat at zero rows.
 *
 * Nothing caught it, because the two things that could have both looked fine:
 * the migration *file* was present, and the migration *count* matched. TypeScript
 * did not catch it either — `.rpc()` is typed against `database.types.ts`, which
 * is generated from the schema, so a missing function should have been a type
 * error. It was not, because the types file was regenerated at a moment when the
 * function briefly existed, or hand-edited, or the call site widened the type.
 *
 * So this test asserts the client's calls against the MIGRATIONS, not against
 * `database.types.ts`. That distinction is load-bearing: the types file already
 * declared all six calendar functions while the database had none of them, so a
 * types-based check passes in exactly the broken state it is meant to catch.
 * Migrations are what was authored; the types file is a generated artefact that
 * can sit ahead of, or behind, both.
 *
 * Three layers, each catching a different failure:
 *   1. this test        — "the client calls something no migration creates"
 *   2. types vs migrations (below) — "the generated types drifted from source"
 *   3. `npm run db:diff` in CI     — "the deployed schema drifted from migrations"
 * Only (3) can catch a migration that was written and never deployed, which is
 * what actually happened. (1) and (2) are cheap and run offline; (3) needs the
 * project link and is the one that must not be skipped.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const SRC = path.join(root, "src");

/** Every `.rpc("name"` literal under src/, with the file it came from. */
function collectRpcCalls(): Map<string, string[]> {
  const calls = new Map<string, string[]>();
  const stack = [SRC];

  while (stack.length > 0) {
    const dir = stack.pop() as string;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules") stack.push(full);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name)) continue;
      // The generated types file *declares* every function; it does not call any.
      if (full.endsWith(path.join("types", "database.types.ts"))) continue;

      const source = fs.readFileSync(full, "utf8");
      for (const m of source.matchAll(/\.rpc\(\s*["'`](fn_[a-z0-9_]+)["'`]/g)) {
        const name = m[1];
        const seen = calls.get(name) ?? [];
        seen.push(path.relative(root, full).replace(/\\/g, "/"));
        calls.set(name, seen);
      }
    }
  }
  return calls;
}

/** Function names created by any migration in `supabase/migrations`. */
function migratedFunctions(): Set<string> {
  const dir = path.join(root, "supabase/migrations");
  const names = new Set<string>();
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".sql")) continue;
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    // `create [or replace] function public.fn_x(` — schema-qualified or not.
    for (const m of sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?(fn_[a-z0-9_]+)\s*\(/gi)) {
      names.add(m[1]);
    }
    // Functions created by a DO block or dynamic SQL would be missed. There are
    // none today; if one appears, add it here rather than loosening the regex.
  }
  return names;
}

/** Function names declared under `Functions:` in the generated database types. */
function declaredFunctions(): Set<string> {
  const types = fs.readFileSync(path.join(SRC, "shared/types/database.types.ts"), "utf8");
  const start = types.indexOf("Functions: {");
  expect(start, "database.types.ts has no Functions block").toBeGreaterThan(-1);

  // Names are the keys of that block. Matching `fn_x: {` anywhere after the
  // block starts is enough — no other construct in this file has that shape.
  const names = new Set<string>();
  for (const m of types.slice(start).matchAll(/^\s{6}(fn_[a-z0-9_]+):\s*\{/gm)) names.add(m[1]);
  return names;
}

describe("RPC contract", () => {
  const calls = collectRpcCalls();
  const migrated = migratedFunctions();
  const declared = declaredFunctions();

  it("finds RPC call sites and definitions to check", () => {
    // A regex that silently matches nothing would make every assertion below
    // vacuously true — the exact failure mode this test exists to prevent.
    expect(calls.size).toBeGreaterThan(20);
    expect(migrated.size).toBeGreaterThan(20);
    expect(declared.size).toBeGreaterThan(20);
  });

  it("every function the client calls is created by a migration", () => {
    const missing = [...calls.entries()]
      .filter(([name]) => !migrated.has(name))
      .map(([name, files]) => `${name}  ←  ${[...new Set(files)].join(", ")}`);

    expect(missing, `RPCs called by the client that no migration creates:\n${missing.join("\n")}`).toEqual([]);
  });

  it("every function the client calls is declared in the generated types", () => {
    const missing = [...calls.keys()].filter((name) => !declared.has(name));
    expect(missing, `RPCs called by the client but absent from database.types.ts:\n${missing.join("\n")}`).toEqual([]);
  });

  it("the six Academic Calendar RPCs are present in both", () => {
    // Named explicitly: these are the ones that were missing from the deployed
    // database, and a regression here is a dead screen plus broken attendance
    // statistics — `fn_attendance_summary` reads `academic_calendar` too.
    for (const fn of [
      "fn_calendar_range",
      "fn_calendar_day",
      "fn_set_calendar_range",
      "fn_clear_calendar_range",
      "fn_upsert_academic_term",
      "fn_delete_academic_term",
    ]) {
      expect(migrated.has(fn), `${fn} is not created by any migration`).toBe(true);
      expect(declared.has(fn), `${fn} is missing from database.types.ts`).toBe(true);
    }
  });
});
