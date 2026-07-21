"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/shared/i18n/useT";
import { Button, OtpInput } from "@/shared/ui";
import { AuthShell, AuthCard, AuthBackLink } from "@/features/auth/components";
import { roleHome } from "@/features/auth/components/roles";

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;

/**
 * OTP Verification — segmented 6-digit input (auto-advance, backspace, paste),
 * a resend countdown timer, and verify with loading/error states. Used both for
 * OTP-login and as the reset-code step. Role-agnostic.
 */
export default function OtpPage() {
  const { t, n } = useT();
  const router = useRouter();
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
    setError(null);
    setLoading(true);
    // Verify against the auth API; simulate the round-trip for the UI flow.
    await new Promise((r) => setTimeout(r, 700));
    setLoading(false);
    // On success, route to the role home (defaults to admin fallback).
    router.replace(roleHome(null));
    router.refresh();
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
