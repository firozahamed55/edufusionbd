"use client";

import { RotateCcw, Save } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { Button, SaveBar, UnsavedDot } from "@/shared/ui";
import { useT } from "@/shared/i18n/useT";
import { useIsReadOnlyYear } from "@/shared/services/academicYear/context";
import type { ReactNode } from "react";

/**
 * Shared shell for the 5 tabbed exam-settings screens (Start / Mark /
 * Marksheet / Comment / Date config). Supplies the page header and the sticky
 * save bar; each screen supplies only its config cards.
 *
 * The tab bar it used to own is now `ModuleTabs` in the exam route layout —
 * this file was the ONE place in the app that got sub-navigation right, and
 * generalising it app-wide was the core of the §9 nav redesign.
 */

export type SettingsTabId = "settings" | "mark" | "marksheet" | "comment" | "date";

const TITLES: Record<SettingsTabId, { bn: string; en: string }> = {
  settings: { bn: "পরীক্ষা শুরু", en: "Exam Start" },
  mark: { bn: "মার্ক কনফিগ", en: "Mark Config" },
  marksheet: { bn: "মার্কশিট কনফিগ", en: "Marksheet Config" },
  comment: { bn: "মন্তব্য কনফিগ", en: "Comment Config" },
  date: { bn: "তারিখ কনফিগ", en: "Date Config" },
};

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
  const readOnly = useIsReadOnlyYear();
  const title = TITLES[active];
  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-h4 font-bold text-text-primary">{t(title.bn, title.en)}</h1>
        <p className="mt-1 text-meta text-text-muted">{t("পরীক্ষা শুরু, মার্ক, মার্কশিট, মন্তব্য ও তারিখ কনফিগারেশন", "Exam start, mark, marksheet, comment & date configuration")}</p>
      </header>

      {children}

      {onSave ? (
        <SaveBar
          status={
            <>
              <UnsavedDot />
              <span>
                {readOnly
                  ? t("আর্কাইভ বর্ষ — সম্পাদনা বন্ধ", "Archived year — editing disabled")
                  : (statusText ?? t("কনফিগারেশন সংরক্ষণ করুন", "Save configuration"))}
              </span>
            </>
          }
        >
          <Button variant="secondary" onClick={onReset} disabled={saving || readOnly}>
            <RotateCcw size={15} /> {t("রিসেট", "Reset")}
          </Button>
          <Button variant="primary" onClick={onSave} disabled={saving || readOnly}>
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
