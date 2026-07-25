"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useT } from "@/shared/i18n/useT";
import { Button, OtpInput } from "@/shared/ui";
import { AuthShell, AuthCard, AuthBackLink } from "@/features/auth/components";

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;

/**
 * OTP Verification — segmented 6-digit input (auto-advance, backspace, paste),
 * a resend countdown timer, and verify with loading/error states. Used both for
 * OTP-login and as the reset-code step. Role-agnostic.
 */
export default function OtpPage() {
  const { t, n } = useT();
  const [code, setCode] = useState("");
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (seconds <= 0) return;
    const id = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [seconds]);

  const canResend = seconds <= 0;

  function resend() {
    if (!canResend) return;
    setSeconds(RESEND_SECONDS);
    setCode("");
    setError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (code.length < OTP_LENGTH) {
      setError(t("সম্পূর্ণ কোড দিন", "Enter the complete code"));
      return;
    }
    // OTP LOGIN IS NOT WIRED. There is no SMS provider yet, so there is nothing
    // to verify this code against.
    //
    // What used to be here was a 700ms `setTimeout` followed by
    // `router.replace(roleHome(null))` — i.e. any six digits "succeeded" and the
    // user was sent to /admin/dashboard. The middleware gate caught them there
    // and bounced them to /login (so this was never an auth bypass), but the
    // screen still claimed to authenticate people, and it would have BECOME a
    // bypass the moment that gate regressed. A login form that lies is worse than
    // one that is honestly unavailable.
    //
    // Replace this block with `supabase.auth.verifyOtp({ phone, token: code })`
    // when the SMS provider is selected; the input, timer and error states above
    // are already the right shape for it.
    setLoading(false);
    setError(
      t(
        "ওটিপি লগইন এখনও চালু হয়নি। পাসওয়ার্ড দিয়ে লগইন করুন।",
        "OTP sign-in isn't available yet. Please sign in with your password.",
      ),
    );
  }

  return (
    <AuthShell>
      <AuthCard
        title={t("কোড যাচাই করুন", "Verify code")}
        subtitle={t(
          "আপনার মোবাইলে পাঠানো ৬-সংখ্যার কোডটি লিখুন।",
          "Enter the 6-digit code sent to your mobile.",
        )}
        footer={<AuthBackLink label={t("লগইনে ফিরে যান", "Back to sign in")} />}
      >
        <form onSubmit={onSubmit} noValidate>
          <OtpInput
            length={OTP_LENGTH}
            value={code}
            onChange={setCode}
            ariaLabel={t("এককালীন কোড", "One-time passcode")}
          />
          {error ? (
            <p className="mt-3 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger-fg" role="alert">
              {error}
            </p>
          ) : null}

          <Button type="submit" size="lg" className="mt-5 w-full justify-center" disabled={loading}>
            {loading ? t("যাচাই হচ্ছে…", "Verifying…") : t("যাচাই করুন", "Verify")}
          </Button>
        </form>

        <div className="mt-5 text-center text-sm text-text-muted">
          {canResend ? (
            <button type="button" onClick={resend} className="font-medium text-primary hover:opacity-80">
              {t("কোড আবার পাঠান", "Resend code")}
            </button>
          ) : (
            <span>
              {t("আবার পাঠান", "Resend in")}{" "}
              <span className="font-semibold tnum text-text-secondary">{n(seconds)}{t(" সেকেন্ডে", "s")}</span>
            </span>
          )}
        </div>
      </AuthCard>
    </AuthShell>
  );
}
