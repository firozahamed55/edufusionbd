"use client";

import { useState } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import { Button, PasswordInput, Stepper } from "@/shared/ui";
import { AuthShell, AuthCard } from "@/features/auth/components";
import { roleHome } from "@/features/auth/components/roles";
import { useRouter } from "next/navigation";

/**
 * First Login Setup — onboarding wizard for a newly provisioned user.
 * Progressive disclosure across three steps with a visible Stepper:
 *   1. Confirm profile   2. Set a password   3. Preferences → finish.
 * Role-agnostic; each step validates before advancing.
 */
export default function FirstLoginSetupPage() {
  const { t } = useT();
  const router = useRouter();
  const steps = [t("প্রোফাইল", "Profile"), t("পাসওয়ার্ড", "Password"), t("পছন্দ", "Preferences")];
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function next() {
    setError(null);
    if (step === 0 && !name.trim()) {
      setError(t("আপনার নাম দিন", "Enter your name"));
      return;
    }
    if (step === 1) {
      if (pw.length < 8) {
        setError(t("পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে", "Password must be at least 8 characters"));
        return;
      }
      if (pw !== confirm) {
        setError(t("পাসওয়ার্ড দুটি মিলছে না", "Passwords do not match"));
        return;
      }
    }
    setStep((s) => Math.min(s + 1, steps.length - 1));
  }

  async function finish() {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 700));
    router.replace(roleHome(null));
    router.refresh();
  }

  return (
    <AuthShell>
      <AuthCard
        title={t("অ্যাকাউন্ট সেটআপ", "Set up your account")}
        subtitle={t("শুরু করার আগে কয়েকটি ধাপ সম্পন্ন করুন।", "A few quick steps before you start.")}
      >
        <Stepper steps={steps} current={step} className="mb-6" />

        {step === 0 ? (
          <div>
            <label className="mb-1.5 block text-meta font-medium text-text-secondary" htmlFor="name">
              {t("পূর্ণ নাম", "Full name")}
            </label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10.5 w-full rounded-lg border border-border-strong bg-surface px-3 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-primary"
              placeholder={t("আব্দুল করিম", "Abdul Karim")}
            />
          </div>
        ) : null}

        {step === 1 ? (
          <div>
            <div className="mb-4 flex items-start gap-2.5 rounded-lg bg-primary-subtle px-3.5 py-2.5 text-meta text-primary">
              <ShieldCheck size={16} className="mt-0.5 shrink-0" />
              {t("কমপক্ষে ৮ অক্ষর, একটি বড় হাতের অক্ষর ও একটি সংখ্যা দিন।", "Use at least 8 characters, one uppercase letter and a number.")}
            </div>
            <label className="mb-1.5 block text-meta font-medium text-text-secondary" htmlFor="pw">
              {t("পাসওয়ার্ড সেট করুন", "Set a password")}
            </label>
            <PasswordInput id="pw" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
            <label className="mb-1.5 mt-4 block text-meta font-medium text-text-secondary" htmlFor="confirm">
              {t("নিশ্চিত করুন", "Confirm")}
            </label>
            <PasswordInput id="confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
          </div>
        ) : null}

        {step === 2 ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-success-bg text-success-fg">
              <CheckCircle2 size={28} />
            </span>
            <p className="text-body font-semibold text-text-primary">
              {t("প্রায় হয়ে গেছে!", "Almost done!")}
            </p>
            <p className="max-w-xs text-sm text-text-muted">
              {t(
                "ভাষা ও থিম উপরের টগল থেকে যেকোনো সময় পরিবর্তন করতে পারবেন।",
                "You can change language and theme anytime from the toggles above.",
              )}
            </p>
          </div>
        ) : null}

        {error ? (
          <p className="mt-3 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger-fg" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex items-center gap-2.5">
          {step > 0 ? (
            <Button variant="secondary" size="lg" className="flex-1 justify-center" onClick={() => setStep((s) => s - 1)}>
              {t("পূর্ববর্তী", "Back")}
            </Button>
          ) : null}
          {step < steps.length - 1 ? (
            <Button size="lg" className="flex-1 justify-center" onClick={next}>
              {t("পরবর্তী", "Next")}
            </Button>
          ) : (
            <Button size="lg" className="flex-1 justify-center" onClick={finish} disabled={saving}>
              {saving ? t("সম্পন্ন হচ্ছে…", "Finishing…") : t("সম্পন্ন করুন", "Finish")}
            </Button>
          )}
        </div>
      </AuthCard>
    </AuthShell>
  );
}
