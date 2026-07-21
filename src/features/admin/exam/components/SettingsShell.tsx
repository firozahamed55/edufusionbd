"use client";

import Link from "next/link";
import { RotateCcw, Save } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { Button, SaveBar, UnsavedDot, Breadcrumb } from "@/shared/ui";
import { useT } from "@/shared/i18n/useT";
import type { ReactNode } from "react";

/**
 * Shared shell for the 5 tabbed exam-settings screens (Start / Mark /
 * Marksheet / Comment / Date config). Provides the header, real tab navigation
 * (Links between the 5 routes) and the sticky save bar; each screen supplies
 * only its config cards. Figma 169:2 + siblings.
 */

export type SettingsTabId = "settings" | "mark" | "marksheet" | "comment" | "date";

const TABS: { id: SettingsTabId; bn: string; en: string; href: string }[] = [
  { id: "settings", bn: "পরীক্ষা শুরু", en: "Exam Start", href: "/admin/exam/settings" },
  { id: "mark", bn: "মার্ক কনফিগ", en: "Mark Config", href: "/admin/exam/mark-config" },
  { id: "marksheet", bn: "মার্কশিট কনফিগ", en: "Marksheet Config", href: "/admin/exam/marksheet-config" },
  { id: "comment", bn: "মন্তব্য কনফিগ", en: "Comment Config", href: "/admin/exam/comment-config" },
  { id: "date", bn: "তারিখ কনফিগ", en: "Date Config", href: "/admin/exam/date-config" },
];

export function SettingsShell({
  active,
  children,
  onSave,
  onReset,
  saving,
  statusText,
}: {
  active: SettingsTabId;
  children: ReactNode;
  onSave?: () => void;
  onReset?: () => void;
  saving?: boolean;
  statusText?: ReactNode;
}) {
  const { t } = useT();
  const activeTab = TABS.find((tab) => tab.id === active);
  return (
    <div className="flex flex-col gap-5">
      <header>
        <Breadcrumb
          items={[
            { label: t("পরীক্ষা ও ফলাফল", "Exam & Results"), href: "/admin/exam/settings" },
            { label: t("সেটিংস", "Settings"), href: "/admin/exam/settings" },
            { label: activeTab ? t(activeTab.bn, activeTab.en) : "" },
          ]}
        />
        <h1 className="mt-1.5 text-h4 font-bold text-text-primary">{t("পরীক্ষা সেটিংস", "Exam Settings")}</h1>
        <p className="mt-1 text-meta text-text-muted">{t("পরীক্ষা শুরু, মার্ক, মার্কশিট, মন্তব্য ও তারিখ কনফিগারেশন", "Exam start, mark, marksheet, comment & date configuration")}</p>
      </header>

      <div className="flex gap-6 overflow-x-auto border-b border-border-default">
        {TABS.map((tab) => (
          <Link
            key={tab.id}
            href={tab.href}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 pb-3 text-sm font-medium transition-colors",
              tab.id === active
                ? "border-primary text-primary"
                : "border-transparent text-text-secondary hover:text-text-primary",
            )}
          >
            {t(tab.bn, tab.en)}
          </Link>
        ))}
      </div>

      {children}

      {onSave ? (
        <SaveBar status={<><UnsavedDot /><span>{statusText ?? t("কনফিগারেশন সংরক্ষণ করুন", "Save configuration")}</span></>}>
          <Button variant="secondary" onClick={onReset} disabled={saving}>
            <RotateCcw size={15} /> {t("রিসেট", "Reset")}
          </Button>
          <Button variant="primary" onClick={onSave} disabled={saving}>
            <Save size={16} /> {saving ? t("সংরক্ষণ হচ্ছে…", "Saving…") : t("সংরক্ষণ করুন", "Save")}
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
