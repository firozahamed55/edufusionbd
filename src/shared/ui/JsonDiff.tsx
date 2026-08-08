"use client";

import { ArrowRight } from "lucide-react";
import { cn } from "@/shared/lib/cn";

/**
 * A field-level diff of two row snapshots (settings audit M-14 / S-11.3).
 *
 * WHAT IT REPLACES. Two `<pre>` blocks of `JSON.stringify(…, null, 2)` at 12 px,
 * side by side. A `student` row is forty keys; finding which one changed meant
 * reading both columns line by line. That is the single most common thing
 * anyone does with an audit record, and the screen made it manual.
 *
 * `changedKeys` is passed in rather than computed here. The server computes it
 * from the RAW values before redaction — otherwise a masked field that changed
 * and a masked field that did not would both render `••• → •••`, and the diff
 * would be confidently wrong about the exact fields that matter most.
 *
 * Unchanged keys collapse into a `<details>` rather than disappearing: "what
 * else was on this row" is a real follow-up question, and hiding it entirely
 * trades one kind of incompleteness for another.
 */

export type JsonDiffProps = {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  /** Keys whose values differ, computed from unmasked values. */
  changedKeys: readonly string[];
  /** Keys whose values are masked in `before`/`after`. */
  redactedKeys?: readonly string[];
  labels: {
    changed: string;
    unchanged: (count: number) => string;
    nothing: string;
    redacted: string;
    added: string;
    removed: string;
  };
};

const render = (v: unknown): string => {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v === "" ? "—" : v;
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
};

export function JsonDiff({ before, after, changedKeys, redactedKeys = [], labels }: JsonDiffProps) {
  const keys = Array.from(new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])).sort();
  const changed = new Set(changedKeys);
  const redacted = new Set(redactedKeys);
  const unchanged = keys.filter((k) => !changed.has(k));

  if (keys.length === 0) {
    return <p className="text-meta text-text-muted">{labels.nothing}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="mb-1.5 text-micro font-semibold uppercase tracking-wide text-text-muted">{labels.changed}</p>
        {changedKeys.length === 0 ? (
          <p className="text-meta text-text-muted">{labels.nothing}</p>
        ) : (
          <dl className="flex flex-col divide-y divide-border-default rounded-lg border border-border-default">
            {keys.filter((k) => changed.has(k)).map((k) => (
              <Row
                key={k}
                name={k}
                before={before && k in before ? before[k] : undefined}
                after={after && k in after ? after[k] : undefined}
                isRedacted={redacted.has(k)}
                labels={labels}
              />
            ))}
          </dl>
        )}
      </div>

      {unchanged.length > 0 ? (
        <details className="rounded-lg border border-border-default">
          <summary className="cursor-pointer px-3 py-2 text-meta font-medium text-text-secondary">
            {labels.unchanged(unchanged.length)}
          </summary>
          <dl className="flex flex-col divide-y divide-border-default border-t border-border-default">
            {unchanged.map((k) => (
              <div key={k} className="grid grid-cols-[minmax(0,10rem)_1fr] gap-3 px-3 py-2">
                <dt className="truncate font-latin text-meta text-text-muted">{k}</dt>
                <dd className="break-words text-meta text-text-secondary">
                  {render((after ?? before ?? {})[k])}
                </dd>
              </div>
            ))}
          </dl>
        </details>
      ) : null}
    </div>
  );
}

function Row({
  name,
  before,
  after,
  isRedacted,
  labels,
}: {
  name: string;
  before: unknown;
  after: unknown;
  isRedacted: boolean;
  labels: JsonDiffProps["labels"];
}) {
  const added = before === undefined;
  const removed = after === undefined;

  return (
    <div className="grid grid-cols-[minmax(0,10rem)_1fr] gap-3 px-3 py-2">
      <dt className="flex min-w-0 flex-col">
        <span className="truncate font-latin text-meta font-medium text-text-primary">{name}</span>
        {isRedacted ? <span className="text-micro text-text-muted">{labels.redacted}</span> : null}
      </dt>
      <dd className="flex min-w-0 flex-wrap items-center gap-2 text-meta">
        {added ? (
          <span className="text-micro font-medium text-success-fg">{labels.added}</span>
        ) : (
          <span className={cn("break-words", removed ? "text-text-secondary" : "text-danger-fg line-through")}>
            {render(before)}
          </span>
        )}
        {added || removed ? null : <ArrowRight size={13} className="shrink-0 text-text-muted" aria-hidden />}
        {removed ? (
          <span className="text-micro font-medium text-danger-fg">{labels.removed}</span>
        ) : (
          <span className="break-words font-medium text-success-fg">{render(after)}</span>
        )}
      </dd>
    </div>
  );
}
