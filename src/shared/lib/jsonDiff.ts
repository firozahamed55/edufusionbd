/**
 * What actually changed between two audit payloads (Settings audit M-14,
 * S-11.3).
 *
 * The Audit Log rendered `before` and `after` as two `JSON.stringify` blobs at
 * 12px, side by side. A `student` UPDATE is forty keys; finding the one that
 * moved is a manual read of eighty lines, done with a finger on the screen.
 * The question the screen exists to answer is "what changed", and the shape
 * that answers it is a list of changed keys.
 *
 * PURE, AND HERE RATHER THAN IN THE COMPONENT, so the comparison rules — what
 * counts as equal, how a nested object is compared, how an added key differs
 * from a removed one — can be tested without rendering anything.
 */

export type JsonChangeKind = "added" | "removed" | "changed";

export type JsonChange = {
  key: string;
  kind: JsonChangeKind;
  before: unknown;
  after: unknown;
};

export type JsonDiffResult = {
  /** Only the keys whose value differs, in stable key order. */
  changes: JsonChange[];
  /** Keys present and identical in both — collapsed by default in the UI. */
  unchanged: string[];
};

/** A record, or nothing. Anything else (array, scalar, null) is not diffable by key. */
function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/**
 * Deep structural equality, via a canonical serialisation.
 *
 * `JSON.stringify` alone is not enough: `{a:1,b:2}` and `{b:2,a:1}` are the
 * same value and serialise differently, and Postgres does not promise a key
 * order for `jsonb` — it stores keys sorted by length then bytewise, so an
 * order-sensitive comparison would report phantom changes on nested objects
 * whenever a key was added.
 */
export function jsonEqual(a: unknown, b: unknown): boolean {
  return canonical(a) === canonical(b);
}

function canonical(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * Keys that say nothing about what a person did.
 *
 * `updated_at` moves on every single UPDATE, so leaving it in means every diff
 * has at least one entry and "1 change" stops meaning anything. `id` and
 * `institution_id` cannot change on an update of one row — if either appears
 * in a diff it is an insert or a delete, where the whole payload is the story
 * anyway.
 */
const NOISE_KEYS = new Set(["updated_at", "institution_id"]);

export function diffJson(before: unknown, after: unknown): JsonDiffResult {
  const a = asRecord(before);
  const b = asRecord(after);

  // An INSERT has no `before` and a DELETE has no `after`. Reporting forty
  // "added" rows for an insert is technically true and useless, so a one-sided
  // payload is handed back whole and the UI shows it as the record it is.
  if (!a || !b) {
    const present = a ?? b;
    if (!present) return { changes: [], unchanged: [] };
    const kind: JsonChangeKind = a ? "removed" : "added";
    return {
      changes: Object.keys(present)
        .filter((k) => !NOISE_KEYS.has(k))
        .sort()
        .map((key) => ({
          key,
          kind,
          before: a ? present[key] : undefined,
          after: a ? undefined : present[key],
        })),
      unchanged: [],
    };
  }

  const changes: JsonChange[] = [];
  const unchanged: string[] = [];

  for (const key of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
    if (NOISE_KEYS.has(key)) continue;
    const inA = Object.prototype.hasOwnProperty.call(a, key);
    const inB = Object.prototype.hasOwnProperty.call(b, key);
    if (inA && inB && jsonEqual(a[key], b[key])) {
      unchanged.push(key);
      continue;
    }
    changes.push({
      key,
      kind: !inA ? "added" : !inB ? "removed" : "changed",
      before: a[key],
      after: b[key],
    });
  }

  return { changes, unchanged };
}

/** One value, as short readable text. `null` prints as an em dash, not "null". */
export function formatJsonValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value === "" ? "—" : value;
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  return JSON.stringify(value);
}
