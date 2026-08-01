"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useT } from "@/shared/i18n/useT";
import { Field, Select, Button, useToast } from "@/shared/ui";
import { ADMIN_ALL_MODULES } from "@/features/admin/components/adminNav";

/** Local preference store. Deliberately not a database column: these are
 *  per-DEVICE choices (a shared office machine and the head teacher's laptop
 *  legitimately differ), and none of them changes what anyone can access. */
const KEY = "efb.preferences";

export type Preferences = { density: "comfortable" | "compact"; landing: string };

const DEFAULTS: Preferences = { density: "comfortable", landing: "/admin/dashboard" };

export function readPreferences(): Preferences {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Preferences>) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

/**
 * Preferences tab of My Account (SRA B-4: "language, theme, density, default
 * landing screen").
 *
 * Language and theme already have working controls in the top bar; this
 * surfaces them where the report says a user will look for them, rather than
 * building a second, competing source of truth for either.
 */
export function PreferencesPanel() {
  const { t, isBn } = useT();
  const toast = useToast();
  const { theme, setTheme } = useTheme();
  const [prefs, setPrefs] = useState<Preferences>(DEFAULTS);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setPrefs(readPreferences());
    setMounted(true);
  }, []);

  function save(next: Preferences) {
    setPrefs(next);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
      document.documentElement.dataset.density = next.density;
      toast({ title: t("সংরক্ষিত হয়েছে", "Saved"), variant: "success" });
    } catch {
      toast({ title: t("এই ব্রাউজারে সংরক্ষণ করা যায়নি", "Could not save in this browser"), variant: "error" });
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-surface p-6 shadow-e1">
      <h2 className="text-base font-semibold text-text-primary">{t("পছন্দ", "Preferences")}</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label={t("সারির ঘনত্ব", "Row density")}
          hint={t("তালিকায় সারির উচ্চতা", "Row height in lists")}
        >
          <Select
            value={prefs.density}
            options={[
              { value: "comfortable", label: t("স্বাভাবিক", "Comfortable") },
              { value: "compact", label: t("ঘন", "Compact") },
            ]}
            onChange={(e) => save({ ...prefs, density: e.target.value as Preferences["density"] })}
          />
        </Field>

        <Field
          label={t("লগইনের পর যেখানে যাবেন", "Landing screen after sign-in")}
          hint={t("রেজিস্ট্রার প্রতিদিন ভর্তি স্ক্রিনে শুরু করেন, ড্যাশবোর্ডে নয়", "A registrar starts on Admissions every day, not the dashboard")}
        >
          <Select
            value={prefs.landing}
            options={ADMIN_ALL_MODULES.map((m) => ({ value: m.href, label: isBn ? m.bn : m.en }))}
            onChange={(e) => save({ ...prefs, landing: e.target.value })}
          />
        </Field>

        <Field label={t("থিম", "Theme")}>
          <Select
            value={mounted ? theme ?? "system" : "system"}
            options={[
              { value: "system", label: t("সিস্টেম অনুযায়ী", "Match system") },
              { value: "light", label: t("লাইট", "Light") },
              { value: "dark", label: t("ডার্ক", "Dark") },
            ]}
            onChange={(e) => setTheme(e.target.value)}
          />
        </Field>

        <Field label={t("ভাষা", "Language")} hint={t("উপরের বার থেকেও পরিবর্তন করা যায়", "Also switchable from the top bar")}>
          <div className="flex h-10.5 items-center gap-2">
            <Button
              variant={isBn ? "primary" : "secondary"}
              onClick={() => { document.cookie = "NEXT_LOCALE=bn;path=/;max-age=31536000"; window.location.reload(); }}
            >
              বাংলা
            </Button>
            <Button
              variant={!isBn ? "primary" : "secondary"}
              onClick={() => { document.cookie = "NEXT_LOCALE=en;path=/;max-age=31536000"; window.location.reload(); }}
            >
              English
            </Button>
          </div>
        </Field>
      </div>

      <p className="text-micro text-text-muted">
        {t(
          "এই পছন্দগুলো এই ব্রাউজারে সংরক্ষিত হয়, অ্যাকাউন্টে নয় — একটি শেয়ার্ড অফিস কম্পিউটার আর ব্যক্তিগত ল্যাপটপের পছন্দ আলাদা হওয়াই স্বাভাবিক।",
          "These are stored in this browser, not on your account — a shared office computer and a personal laptop reasonably differ.",
        )}
      </p>
    </section>
  );
}
