"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, Phone } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import { Button, Field, Input } from "@/shared/ui";
import { AuthShell, AuthCard, AuthBackLink } from "@/features/auth/components";
import { createClient } from "@/shared/services/supabase/client";
import { resolveLoginEmail, isPhoneIdentity } from "@/features/auth/lib/identity";

/**
 * The school office's own number, for the recovery route a phone-identity user
 * actually has (A-2). Public by nature — it is on the institution's signboard.
 *
 * It comes from the environment rather than from the `institution` table
 * because this screen is UNAUTHENTICATED: every institution row is behind RLS,
 * and there is no session here to scope a read by. When it is unset the screen
 * still says who to ask; it just cannot say what number to ring.
 */
const SCHOOL_PHONE = process.env.NEXT_PUBLIC_SCHOOL_CONTACT_PHONE;

/**
 * Forgot Password.
 *
 * A-2 was the finding that mattered here. The product's stated primary
 * identifier is a mobile number — `/login` labels the field "Mobile number" —
 * and `identity.ts` maps it to a synthetic `@phone.edufusionbd.app` address
 * that has no inbox. This screen then refused exactly those users with a flat
 * "password reset by email is only available for accounts with an email
 * address", and `/otp` is off until an SMS provider is contracted. So the
 * DEFAULT user of the product, on forgetting their password, hit a sentence
 * that told them what would not work and nothing about what would.
 *
 * The SMS route is Phase 4 W13 and is not buildable today. The dead end is, and
 * that is what this fixes: a phone identity now gets the recovery path that
 * genuinely exists — the school office can reset it — named, with a number.
 */
export default function ForgotPasswordPage() {
  const { t } = useT();
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  /** Set when the entered identity has no inbox — a route, not a failure. */
  const [askOffice, setAskOffice] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!identifier.trim()) {
      setError(t("মোবাইল নম্বর বা ইমেইল দিন", "Enter your mobile number or email"));
      return;
    }
    const email = resolveLoginEmail(identifier);
    setError(null);
    // Phone-only accounts have no inbox — email reset cannot reach them.
    if (isPhoneIdentity(email)) {
      setAskOffice(true);
      return;
    }
    setLoading(true);
    // Fire the reset email, then ALWAYS show success — never reveal whether an
    // account exists (avoids user enumeration).
    await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    setSent(true);
  }

  if (askOffice) {
    return (
      <AuthShell>
        <AuthCard
          title={t("স্কুল অফিস আপনার পাসওয়ার্ড রিসেট করে দেবে", "Your school office can reset it")}
          subtitle={t(
            "মোবাইল নম্বর দিয়ে খোলা অ্যাকাউন্টে ইমেইল যায় না, তাই নিজে থেকে রিসেট করা যাচ্ছে না। প্রতিষ্ঠানের অফিসে জানালে তারা সঙ্গে সঙ্গে নতুন পাসওয়ার্ড দিয়ে দিতে পারবেন।",
            "Accounts opened with a mobile number have no inbox, so a reset link cannot reach you. Your school office can set a new password for you straight away.",
          )}
          footer={<AuthBackLink label={t("লগইনে ফিরে যান", "Back to sign in")} />}
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-3 rounded-lg bg-info-bg px-4 py-3 text-sm text-info-fg">
              <Phone size={18} className="mt-0.5 shrink-0" />
              <span>
                {SCHOOL_PHONE ? (
                  <>
                    {t("অফিসে ফোন করুন", "Call the office")}{" "}
                    <a href={`tel:${SCHOOL_PHONE}`} className="font-semibold underline tnum">
                      {SCHOOL_PHONE}
                    </a>
                  </>
                ) : (
                  t(
                    "আপনার প্রতিষ্ঠানের অফিসে যোগাযোগ করুন।",
                    "Contact your institution's office.",
                  )
                )}
              </span>
            </div>
            <p className="text-sm text-text-secondary">
              {t(
                "অফিসে আপনার নাম ও মোবাইল নম্বরটি বলুন — যে নম্বর দিয়ে অ্যাকাউন্ট খোলা হয়েছিল।",
                "Give them your name and the mobile number the account was opened with.",
              )}
            </p>
            <Button
              variant="secondary"
              size="lg"
              className="mt-1 w-full justify-center"
              onClick={() => setAskOffice(false)}
            >
              {t("অন্য নম্বর বা ইমেইল দিন", "Try a different number or email")}
            </Button>
          </div>
        </AuthCard>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      {sent ? (
        <AuthCard
          title={t("ইমেইল দেখুন", "Check your email")}
          subtitle={t(
            "যদি এই ঠিকানায় কোনো অ্যাকাউন্ট থাকে, আমরা একটি পাসওয়ার্ড রিসেট লিংক পাঠিয়েছি। লিংকে ক্লিক করে নতুন পাসওয়ার্ড দিন।",
            "If an account exists for this address, we've sent a password reset link. Click it to set a new password.",
          )}
          footer={<AuthBackLink label={t("লগইনে ফিরে যান", "Back to sign in")} />}
        >
          <div className="flex items-start gap-3 rounded-lg bg-success-bg px-4 py-3 text-sm text-success-fg">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
            <span>
              {t("পাঠানো হয়েছে", "Sent to")} <span className="font-semibold tnum">{identifier}</span>
            </span>
          </div>
        </AuthCard>
      ) : (
        <AuthCard
          title={t("পাসওয়ার্ড ভুলে গেছেন?", "Forgot password?")}
          subtitle={t(
            "আপনার মোবাইল নম্বর বা ইমেইল দিন — কীভাবে ফিরে পাবেন আমরা দেখিয়ে দিচ্ছি।",
            "Enter your mobile number or email and we'll show you how to get back in.",
          )}
          footer={<AuthBackLink label={t("লগইনে ফিরে যান", "Back to sign in")} />}
        >
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
            <Field label={t("মোবাইল নম্বর বা ইমেইল", "Mobile number or email")} error={error ?? undefined}>
              <Input
                id="identifier"
                type="text"
                value={identifier}
                onChange={(e) => { setIdentifier(e.target.value); setError(null); }}
                className="tnum"
                placeholder="+880 1712-345678"
              />
            </Field>
            <Button type="submit" size="lg" className="mt-1 w-full justify-center" disabled={loading}>
              {loading ? t("পাঠানো হচ্ছে…", "Sending…") : t("এগিয়ে যান", "Continue")}
            </Button>
          </form>
        </AuthCard>
      )}
    </AuthShell>
  );
}
