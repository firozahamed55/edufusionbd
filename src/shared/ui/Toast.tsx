"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import type { ReactNode } from "react";

type ToastVariant = "success" | "error" | "info";
type ToastItem = { id: number; title: string; description?: string; variant: ToastVariant };
type ToastInput = { title: string; description?: string; variant?: ToastVariant };

const ToastContext = createContext<((t: ToastInput) => void) | null>(null);

/** Fire a toast from any client component: `const toast = useToast(); toast({ title, variant })`. */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

const meta: Record<ToastVariant, { Icon: typeof Info; cls: string }> = {
  success: { Icon: CheckCircle2, cls: "bg-success-bg text-success-fg" },
  error: { Icon: AlertCircle, cls: "bg-danger-bg text-danger-fg" },
  info: { Icon: Info, cls: "bg-info-bg text-info-fg" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const remove = useCallback(
    (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id)),
    [],
  );

  const push = useCallback(
    ({ title, description, variant = "info" }: ToastInput) => {
      const id = (idRef.current += 1);
      setToasts((prev) => [...prev, { id, title, description, variant }]);
      setTimeout(() => remove(id), 5000);
    },
    [remove],
  );

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-100 flex w-full max-w-sm flex-col gap-2.5"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map((t) => {
          const { Icon, cls } = meta[t.variant];
          return (
            <div
              key={t.id}
              role="status"
              aria-live="polite"
              className="pointer-events-auto flex items-start gap-3 rounded-xl border border-border-default bg-surface-raised p-3.5 shadow-e3"
            >
              <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", cls)}>
                <Icon size={18} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text-primary">{t.title}</p>
                {t.description ? (
                  <p className="mt-0.5 text-xs text-text-muted">{t.description}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => remove(t.id)}
                aria-label="Dismiss notification"
                className="grid size-6 shrink-0 place-items-center rounded-md text-text-muted hover:bg-sunken"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
