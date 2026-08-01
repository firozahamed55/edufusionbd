"use client";

import { ArrowRight } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { diffJson, formatJsonValue, type JsonChangeKind } from "@/shared/lib/jsonDiff";
import { isPiiKey, REDACTED } from "@/shared/lib/auditRedaction";

/**
 * Two audit payloads as the list of things that changed (audit M-14, S-11.3,
 * and A-6 for the accessibility half).
 *
 * REPLACES two `<pre>` blocks of raw JSON at 12px with no accessible name and
 * no way to reach their scrollbar from a keyboard. What is here instead is a
 * definition list — `key · before → after` — at `text-meta`, with the unchanged
 * keys behind a `<details>` because their only job is to reassure the reader
 * that nothing else moved.
 *
 * The component takes bilingual strings as props rather than calling `useT`.
 * `shared/ui` cannot import a feature, and every other primitive in this
 * directory takes its copy from the caller for the same reason; the caller is
 * always inside a locale context and always knows the two strings.
 */

const KIND_TONE: Record<JsonChangeKind, string> = {
  added: "bg-success-bg text-success-fg",
  removed: "bg-danger-bg text-danger-fg",
  changed: "bg-warning-bg text-warning-fg",
};

export function JsonDiff({
  before,
  after,
  labels,
  /** When false, values under a PII-shaped key print as `•••••`. */
  revealed = false,
  className,
}: {
  before: unknown;
  after: unknown;
  labels: {
    /** e.g. "৩টি পরিবর্তন" / "3 changes" — the caller localises the numeral. */
    changeCount: (n: number) => string;
    noChanges: string;
    unchanged: (n: number) => string;
    kind: Record<JsonChangeKind, string>;
  };
  revealed?: boolean;
  className?: string;
}) {
  const { changes, unchanged } = diffJson(before, after);
  const show = (key: string, value: unknown) =>
    !revealed && isPiiKey(key) ? REDACTED : formatJsonValue(value);

  if (changes.length === 0) {
    return <p className={cn("text-meta text-text-muted", className)}>{labels.noChanges}</p>;
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <p className="text-meta font-medium text-text-secondary">{labels.changeCount(changes.length)}</p>

      <dl className="flex flex-col divide-y divide-border-default rounded-lg border border-border-default">
        {changes.map((c) => (
          <div key={c.key} className="flex flex-col gap-1 px-3 py-2.5">
            <dt className="flex items-center gap-2">
              <span className="font-latin text-meta font-semibold text-text-primary">{c.key}</span>
              <span className={cn("rounded px-1.5 py-0.5 text-micro font-medium", KIND_TONE[c.kind])}>
                {labels.kind[c.kind]}
              </span>
            </dt>
            <dd className="flex flex-wrap items-center gap-2 text-meta">
              <span className="break-all text-text-muted line-through decoration-text-decorative">
                {show(c.key, c.before)}
              </span>
              <ArrowRight size={13} className="shrink-0 text-text-decorative" aria-hidden />
              <span className="break-all font-medium text-text-primary">{show(c.key, c.after)}</span>
            </dd>
          </div>
        ))}
      </dl>

      {unchanged.length > 0 ? (
        <details className="rounded-lg border border-border-default px-3 py-2">
          <summary className="cursor-pointer text-meta text-text-secondary">
            {labels.unchanged(unchanged.length)}
          </summary>
          <p className="mt-2 break-all font-latin text-meta text-text-muted">{unchanged.join(", ")}</p>
        </details>
      ) : null}
    </div>
  );
}
