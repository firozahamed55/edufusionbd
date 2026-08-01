"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "./Dialog";
import { Button } from "./Button";
import { Input, Textarea } from "./Form";
import type { ReactNode } from "react";

/**
 * Confirmation for high-blast-radius, irreversible operations (audit B-2).
 *
 * `Delete Fees`, `Migration Pushback` and `Result Process` act on thousands of
 * institution-wide rows behind a single button. `ConfirmDialog` existed but
 * only as a yes/no — the same weight as confirming a dismissed toast — and a
 * mis-click had no recovery path.
 *
 * Two things make this different from a plain confirm: the operator must TYPE
 * the affected row count, which cannot be done by reflex, and they are shown a
 * preview of what actually dies rather than a number they have to trust.
 *
 * `reasonLabel` adds a third: a mandatory free-text reason handed back to
 * `onConfirm` (SRA A-6.2 on Delete Fees, A-7 point 7 on cancelling a document
 * batch). An irreversible institution-wide write that records WHAT changed and
 * not WHY leaves the auditor with a row count and no story.
 */
export function DangerConfirm({
  open,
  onClose,
  onConfirm,
  title,
  description,
  count,
  preview,
  confirmLabel,
  cancelLabel,
  typeToConfirmLabel,
  reasonLabel,
  reasonPlaceholder,
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  /** Receives the typed reason when `reasonLabel` is set, else `undefined`. */
  onConfirm: (reason?: string) => void;
  title: string;
  description: string;
  /** Number of rows this destroys — also the phrase the operator must type. */
  count: number;
  /** A sample of the affected records, so the count is verifiable. */
  preview?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  /** e.g. `Type DELETE 1248 to confirm` — caller owns the wording for i18n. */
  typeToConfirmLabel: (phrase: string) => string;
  /** Set to require a reason. Omit for confirmations that need none. */
  reasonLabel?: string;
  reasonPlaceholder?: string;
  loading?: boolean;
}) {
  const phrase = String(count);
  const [typed, setTyped] = useState("");
  const [reason, setReason] = useState("");

  // Never carry a previous confirmation into the next dialog.
  useEffect(() => {
    if (open) { setTyped(""); setReason(""); }
  }, [open]);

  const armed = typed.trim() === phrase && count > 0 && (!reasonLabel || reason.trim().length > 0);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      className="max-w-lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant="danger" onClick={() => onConfirm(reasonLabel ? reason.trim() : undefined)} disabled={!armed} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-2.5 rounded-xl border border-danger-fg/30 bg-danger-bg px-3.5 py-3 text-meta text-danger-fg">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
          <p>{description}</p>
        </div>

        {preview ? (
          <div className="max-h-32 overflow-y-auto rounded-xl bg-sunken px-3.5 py-3 text-meta text-text-secondary">
            {preview}
          </div>
        ) : null}

        <label className="flex flex-col gap-1.5">
          <span className="text-meta font-medium text-text-secondary">
            {typeToConfirmLabel(phrase)}
          </span>
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            inputMode="numeric"
            autoComplete="off"
            className="font-latin"
          />
        </label>

        {reasonLabel ? (
          <label className="flex flex-col gap-1.5">
            <span className="text-meta font-medium text-text-secondary">{reasonLabel}</span>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder={reasonPlaceholder}
            />
          </label>
        ) : null}
      </div>
    </Modal>
  );
}
