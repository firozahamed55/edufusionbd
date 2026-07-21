"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2 } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import { Button } from "@/shared/ui";
import { AuthShell, AuthCard, AuthBackLink } from "@/features/auth/components";
import { createClient } from "@/shared/services/supabase/client";
import { resolveLoginEmail, isPhoneIdentity } from "@/features/auth/lib/identity";

/**
 * Forgot Password — collect the mobile number / email, then show a success
 * state confirming a reset code was sent (which routes to /reset-password).
 * Role-agnostic; validation + loading + success states.
 */
export default function ForgotPasswordPage() {
  const { t } = useT();
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!identifier.trim()) {
      setError(t("মোবাইল নম্বর বা ইমেইল দিন", "Enter your mobile number or email"));
      return;
    }
    const email = resolveLoginEmail(identifier);
    // Phone-only accounts have no inbox — email reset can't reach them (yet).
    if (isPhoneIdentity(email)) {
      setError(
        t(
          "শুধু ইমেইল-ঠিকানাযুক্ত অ্যাকাউন্টের জন্যই পাসওয়ার্ড রিসেট সম্ভব।",
          "Password reset by email is only available for accounts with an email address.",
        ),
      );
      return;
    }
    setError(null);
    setLoading(true);
    // Fire the reset email, then ALWAYS show success — never reveal whether an
    // account exists (avoids user enumeration).
    await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    setSent(true);
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
            "আপনার মোবাইল নম্বর দিন — আমরা একটি রিসেট কোড পাঠাবো।",
            "Enter your mobile number and we'll send a reset code.",
          )}
          footer={<AuthBackLink label={t("লগইনে ফিরে যান", "Back to sign in")} />}
        >
          <form onSubmit={onSubmit} noValidate>
            <label className="mb-1.5 block text-meta font-medium text-text-secondary" htmlFor="identifier">
              {t("মোবাইল নম্বর বা ইমেইল", "Mobile number or email")}
            </label>
            <input
              id="identifier"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="h-10.5 w-full rounded-lg border border-border-strong bg-surface px-3 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-primary tnum"
              placeholder="+880 1712-345678"
            />
            {error ? (
              <p className="mt-3 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger-fg" role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" size="lg" className="mt-5 w-full justify-center" disabled={loading}>
              {loading ? t("পাঠানো হচ্ছে…", "Sending…") : t("রিসেট কোড পাঠান", "Send reset code")}
            </Button>
          </form>
        </AuthCard>
      )}
    </AuthShell>
  );
}
