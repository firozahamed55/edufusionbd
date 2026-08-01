"use client";

import { useMemo } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { PASSWORD_RULES, STRENGTH_LABELS, passedRules, scorePassword } from "@/shared/lib/passwordPolicy";

const TONES = ["bg-danger-fg", "bg-danger-fg", "bg-warning-fg", "bg-success-fg", "bg-success-fg"];

/**
 * Live requirement checklist + strength meter (SRA B-5).
 *
 * "No strength meter, no stated requirements" — so a user typed a password,
 * pressed Save, and was told after the fact what was wrong. The checklist is
 * generated from the same `PASSWORD_RULES` the acceptance predicate uses, so
 * the list can never drift from the gate.
 *
 * `aria-live="polite"` on the meter: a screen-reader user who cannot see four
 * bars change colour still hears the password get stronger.
 */
export function PasswordRequirements({ value, className }: { value: string; className?: string }) {
  const { t, n } = useT();
  const passed = useMemo(() => passedRules(value), [value]);
  const score = useMemo(() => scorePassword(value), [value]);
  const label = STRENGTH_LABELS[score];

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={cn("h-1 flex-1 rounded-full transition-colors", i < score ? TONES[score] : "bg-border-strong")}
            />
          ))}
        </div>
        <span className="text-xs text-text-muted" aria-live="polite">
          {value ? t(label.bn, label.en) : ""}
        </span>
      </div>

      <ul className="flex flex-col gap-1">
        {PASSWORD_RULES.map((rule) => {
          const ok = passed.has(rule.key);
          return (
            <li
              key={rule.key}
              className={cn("flex items-center gap-1.5 text-xs", ok ? "text-success-fg" : "text-text-muted")}
            >
              {/* A non-colour cue as well as the colour (WCAG 1.4.1) — the tick
                  and the cross differ in shape, not only in hue. */}
              {ok ? <Check size={13} aria-hidden /> : <X size={13} aria-hidden />}
              <span>{t(rule.bn, rule.en)}</span>
              <span className="sr-only">{ok ? t("পূরণ হয়েছে", "met") : t("পূরণ হয়নি", "not met")}</span>
            </li>
          );
        })}
      </ul>

      <p className="text-xs text-text-muted">
        {t(
          `${n(PASSWORD_RULES.length)}টির মধ্যে অন্তত ৩টি পূরণ করতে হবে, দৈর্ঘ্যসহ।`,
          `At least 3 of ${PASSWORD_RULES.length}, including length.`,
        )}
      </p>
    </div>
  );
}
