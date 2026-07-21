"use client";

import Link from "next/link";
import { RotateCcw, Save } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { Button, SaveBar, UnsavedDot } from "@/shared/ui";
import type { ReactNode } from "react";

/**
 * Shared shell for the 5 tabbed exam-settings screens (পরীক্ষা শুরু / মার্ক /
 * মার্কশিট / মন্তব্য / তারিখ কনফিগ). Provides the header, real tab navigation
 * (Links between the 5 routes) and the sticky save bar; each screen supplies
 * only its config cards. Figma 169:2 + siblings.
 */

const TABS = [
  { label: "পরীক্ষা শুরু", href: "/admin/exam/settings" },
  { label: "মার্ক কনফিগ", href: "/admin/exam/mark-config" },
  { label: "মার্কশিট কনফিগ", href: "/admin/exam/marksheet-config" },
  { label: "মন্তব্য কনফিগ", href: "/admin/exam/comment-config" },
  { label: "তারিখ কনফিগ", href: "/admin/exam/date-config" },
];

export function SettingsShell({
  active,
  children,
  onSave,
  onReset,
  saving,
  statusText,
}: {
  active: string;
  children: ReactNode;
  onSave?: () => void;
  onReset?: () => void;
  saving?: boolean;
  statusText?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5">
      <header>
        <div className="flex items-center gap-1.5 text-meta text-text-muted">
          <span>পরীক্ষা ও ফলাফল</span>
          <span>›</span>
          <span>সেটিংস</span>
          <span>›</span>
          <span className="text-text-secondary">{active}</span>
        </div>
        <h1 className="mt-1.5 text-h4 font-bold text-text-primary">পরীক্ষা সেটিংস</h1>
        <p className="mt-1 text-meta text-text-muted">পরীক্ষা শুরু, মার্ক, মার্কশিট, মন্তব্য ও তারিখ কনফিগারেশন</p>
      </header>

      <div className="flex gap-6 overflow-x-auto border-b border-border-default">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 pb-3 text-sm font-medium transition-colors",
              t.label === active
                ? "border-primary text-primary"
                : "border-transparent text-text-secondary hover:text-text-primary",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {children}

      {onSave ? (
        <SaveBar status={<><UnsavedDot /><span>{statusText ?? "কনফিগারেশন সংরক্ষণ করুন"}</span></>}>
          <Button variant="secondary" onClick={onReset} disabled={saving}>
            <RotateCcw size={15} /> রিসেট
          </Button>
          <Button variant="primary" onClick={onSave} disabled={saving}>
            <Save size={16} /> {saving ? "সংরক্ষণ হচ্ছে…" : "সংরক্ষণ করুন"}
          </Button>
        </SaveBar>
      ) : null}
    </div>
  );
}

export function ExamToggle({ on }: { on?: boolean }) {
  return (
    <span className={cn("relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors", on ? "bg-primary" : "bg-border-strong")}>
      <span className={cn("absolute size-5 rounded-full bg-white transition-all", on ? "right-0.5" : "left-0.5")} />
    </span>
  );
}
