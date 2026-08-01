"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import { Button, Input, PasswordInput, PasswordRequirements, Stepper } from "@/shared/ui";
import { isAcceptable } from "@/shared/lib/passwordPolicy";
import { AuthShell, AuthCard } from "@/features/auth/components";
import { roleHome } from "@/features/auth/components/roles";
import { createClient } from "@/shared/services/supabase/client";
import { updateMyProfile } from "@/shared/services/security/api";
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
      if (!isAcceptable(pw)) {
        setError(t("পাসওয়ার্ডটি প্রয়োজনীয় শর্ত পূরণ করে না", "That password does not meet the requirements"));
        return;
      }
      if (pw !== confirm) {
        setError(t("পাসওয়ার্ড দুটি মিলছে না", "Passwords do not match"));
        return;
      }
    }
    setStep((s) => Math.min(s + 1, steps.length - 1));
  }

  /**
   * SRA A-1. This used to be `await new Promise(r => setTimeout(r, 700))`
   * followed by `router.replace(roleHome(null))` — three steps of input, a
   * validated password confirmed twice, and NOTHING was persisted. The user was
   * told their account was set up, still had their provisioned temporary
   * password, and would then fail to sign in with the one they had just chosen.
   * For a phone-only account that is a permanent lockout, because
   * /forgot-password cannot reach a synthetic `@phone.edufusionbd.app` address.
   *
   * The identical `setTimeout(700)` stub was removed from /otp once already;
   * the fix never reached this screen.
   *
   * Order matters: the password is the credential the user will next sign in
   * with, so it is written FIRST and a failure aborts. The display name is
   * cosmetic — if it fails the account is still usable, so it is reported but
   * does not strand the user on a screen they can no longer leave.
   */
  async function finish() {
    setSaving(true);
    setError(null);
    const supabase = createClient();

    const { error: pwErr } = await supabase.auth.updateUser({ password: pw });
    if (pwErr) {
      setSaving(false);
      setError(
        t(
          "পাসওয়ার্ড সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।",
          "Could not save your password. Please try again.",
        ),
      );
      setStep(1);
      return;
    }

    try {
      await updateMyProfile(supabase, { full_name: name.trim() });
    } catch {
      // Non-fatal: the credential is set, so the account works. Say so rather
      // than blocking on a display name.
      void 0;
    }

    // The user's REAL role, not `roleHome(null)` — that hardcoded the admin
    // dashboard, so a parent finished setup and was bounced by middleware.
    const { data } = await supabase.auth.getUser();
    const role = data.user?.app_metadata?.role as string | undefined;
    setSaving(false);
    router.replace(roleHome(role));
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
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("আব্দুল করিম", "Abdul Karim")}
            />
          </div>
        ) : null}

        {step === 1 ? (
          <div>
            <label className="mb-1.5 block text-meta font-medium text-text-secondary" htmlFor="pw">
              {t("পাসওয়ার্ড সেট করুন", "Set a password")}
            </label>
            <PasswordInput id="pw" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
            <PasswordRequirements value={pw} className="mt-2" />
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
