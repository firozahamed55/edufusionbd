"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { Button } from "./Button";
import type { ReactNode } from "react";

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * The focus-trap half of `Modal`, extracted so any overlay (drawer, dropdown
 * menu) can get the same WCAG 2.4.3/2.1.2 behavior — move focus in on open,
 * cycle Tab/Shift+Tab within the panel, close on Escape, restore focus to the
 * trigger on close (audit T-7: the mobile drawer and profile menu had none of
 * this despite this exact trap already existing here, unused, for `Modal`).
 * Pass `lockScroll: false` for a lightweight dropdown that shouldn't freeze
 * the page behind it.
 */
export function useFocusTrap(
  panelRef: React.RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
  opts: { lockScroll?: boolean } = {},
) {
  const restoreRef = useRef<HTMLElement | null>(null);
  const { lockScroll = true } = opts;

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === "Tab" && panel) {
        const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
          (el) => el.offsetParent !== null,
        );
        if (nodes.length === 0) {
          e.preventDefault();
          panel.focus();
          return;
        }
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKey, true);
    const prevOverflow = document.body.style.overflow;
    if (lockScroll) document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey, true);
      if (lockScroll) document.body.style.overflow = prevOverflow;
      restoreRef.current?.focus?.();
    };
  }, [open, onClose, panelRef, lockScroll]);
}

/**
 * Accessible modal dialog — the missing "confirm / detail" archetype.
 * Implements a full focus trap (WCAG 2.4.3 + 2.1.2) via `useFocusTrap`, locks
 * body scroll, and closes on Escape or overlay click.
 * Controlled: the caller owns `open` and `onClose`.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();

  useFocusTrap(panelRef, open, onClose);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          "relative z-10 w-full max-w-md rounded-2xl border border-border-default bg-surface p-6 shadow-e3 focus:outline-none",
          className,
        )}
      >
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <h2 id={titleId} className="text-lg font-semibold text-text-primary">
              {title}
            </h2>
            {description ? (
              <p id={descId} className="mt-1 text-sm text-text-muted">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="grid size-8 shrink-0 place-items-center rounded-lg text-text-muted hover:bg-sunken"
          >
            <X size={18} />
          </button>
        </div>
        {children ? <div className="mt-4">{children}</div> : null}
        {footer ? <div className="mt-6 flex flex-wrap justify-end gap-2.5">{footer}</div> : null}
      </div>
    </div>
  );
}

/**
 * Confirmation dialog — enforces a deliberate step before destructive actions.
 *
 * `children` and `confirmDisabled` exist for `ImpactPreview` (settings audit
 * M-16): a confirm that lists what points at the record, and refuses outright
 * when one of those references is a hard one. A hard reference is not something
 * to warn about — it is something the dialog must not let happen.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "primary",
  loading = false,
  confirmDisabled = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
  loading?: boolean;
  confirmDisabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            onClick={onConfirm}
            disabled={loading || confirmDisabled}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}
