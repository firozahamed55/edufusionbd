"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Smartphone, WifiOff } from "lucide-react";
import { createClient } from "@/shared/services/supabase/client";
import { resolveLoginEmail } from "@/features/auth/lib/identity";
import { useT } from "@/shared/i18n/useT";
import { Button, Input, PasswordInput } from "@/shared/ui";
import { AuthShell, AuthCard } from "@/features/auth/components";
import { roleHome, isRole, safeInternalPath, ROLE_LABELS } from "@/features/auth/components/roles";
import { useErrorMessage } from "@/shared/services/errors";
import { useOnline } from "@/shared/lib/useOnline";
import * as security from "@/shared/services/security/api";

/**
 * SRA B-1. The OTP entry point invited every first-time parent and teacher —
 * the users least able to recover — into a screen that then says "OTP sign-in
 * isn't available yet". The screen is right to be honest; the DOOR should not
 * have been there. Off unless an SMS provider is actually contracted, and
 * flipped in the same release that ships one.
 */
const OTP_ENABLED = process.env.NEXT_PUBLIC_OTP_ENABLED === "true";

/**
 * Login — Figma split-panel. Primary identifier is a mobile number (how
 * Bangladeshi parents log in); an email is also accepted so the existing
 * Supabase email/password flow keeps working (audit 7.2). Includes
 * show/hide password, forgot-password link, field-level validation, offline and
 * account-locked states, and the MFA hand-off.
 */
export default function LoginPage() {
  const { t } = useT();
  const msg = useErrorMessage();
  const router = useRouter();
  const params = useSearchParams();
  // Role the user picked on the Role Selection screen — drives the header only.
  // The signed-in JWT role (below) is authoritative for where they actually land.
  const roleParam = params.get("role");
  const selectedRole = isRole(roleParam) ? roleParam : null;
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const online = useOnline();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: resolveLoginEmail(identifier),
      password,
    });
    if (error) {
      setLoading(false);
      // Account-locked is its own state (SRA B-7), not a credentials error:
      // telling a locked-out user their password is wrong sends them to reset
      // it, which does not help and burns the reset quota as well.
      setLocked(/locked|banned|too many/i.test(error.message));
      // Supabase Auth throttles /auth/v1/token per IP and answers 429. Reporting
      // that as "wrong password" made a throttled user retry harder, which keeps
      // the token bucket empty — so the classifier distinguishes them and only
      // falls back to the credentials message for a genuine rejection.
      setError(msg(error, {
        bn: "মোবাইল নম্বর/ইমেইল বা পাসওয়ার্ড ভুল",
        en: "Invalid mobile number/email or password",
      }));
      return;
    }

    const redirect = params.get("redirect");

    /**
     * SRA B-2. A password is only the FIRST factor. If this account has a
     * verified authenticator, the session is still `aal1` and must be
     * challenged before it reaches anything.
     *
     * `nextLevel` is Supabase's own answer to "does this session still owe a
     * factor", so the app is not keeping a parallel notion of it that could
     * drift. A failure to READ it routes to /2fa rather than past it — and
     * /2fa re-checks and forwards when there is nothing to challenge, so an
     * institution with no MFA at all is not locked out by a transient error.
     */
    try {
      const aal = await security.assuranceLevel(supabase);
      if (aal.next === "aal2" && aal.current !== "aal2") {
        router.replace(`/2fa${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ""}`);
        return;
      }
    } catch {
      router.replace(`/2fa${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ""}`);
      return;
    }

    void security.recordSecurityEvent(supabase, "auth.sign_in");
    // app_metadata only — user_metadata is client-writable (see middleware.ts).
    const actualRole = data.user?.app_metadata?.role as string | undefined;
    // Honor a safe internal deep-link (middleware sets ?redirect=…), else land
    // on the dashboard for the user's REAL role. External redirects are rejected.
    const dest = safeInternalPath(redirect) ?? roleHome(actualRole);
    router.replace(dest);
    router.refresh();
  }

  return (
    <AuthShell>
      <AuthCard
        title={t("স্বাগতম", "Welcome back")}
        subtitle={
          selectedRole
            ? t(
                `${ROLE_LABELS[selectedRole].bn} হিসেবে প্রবেশ করুন`,
                `Sign in as ${ROLE_LABELS[selectedRole].en}`,
              )
            : t("আপনার অ্যাকাউন্টে প্রবেশ করুন", "Sign in to your account")
        }
        footer={
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-opacity hover:opacity-80"
          >
            ← {t("ভিন্ন ভূমিকা নির্বাচন করুন", "Choose a different role")}
          </Link>
        }
      >
        {!online ? (
          <p
            className="mb-4 flex items-center gap-2 rounded-lg bg-warning-bg px-3 py-2 text-sm text-warning-fg"
            role="status"
          >
            <WifiOff size={16} className="shrink-0" />
            {t("ইন্টারনেট সংযোগ নেই — লগইনের জন্য সংযোগ প্রয়োজন।", "You are offline — signing in needs a connection.")}
          </p>
        ) : null}

        <form onSubmit={onSubmit} noValidate>
          <label
            className="mb-1.5 block text-meta font-medium text-text-secondary"
            htmlFor="identifier"
          >
            {t("মোবাইল নম্বর", "Mobile number")}
          </label>
          {/* The shared primitive, not a hand-rolled copy of it. The copy used
              `border-border-strong` — the decorative token, which does not meet
              the 3:1 an interactive boundary owes (SC 1.4.11); `controlBase`
              uses `border-border-control`, which does. */}
          <Input
            id="identifier"
            type="text"
            inputMode="tel"
            required
            autoComplete="username"
            value={identifier}
            onChange={(e) => { setIdentifier(e.target.value); setLocked(false); }}
            className="mb-4 tnum"
            placeholder="+880 1712-345678"
          />

          <label
            className="mb-1.5 block text-meta font-medium text-text-secondary"
            htmlFor="password"
          >
            {t("পাসওয়ার্ড", "Password")}
          </label>
          <PasswordInput
            id="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            showLabel={t("পাসওয়ার্ড দেখান", "Show password")}
            hideLabel={t("পাসওয়ার্ড লুকান", "Hide password")}
          />

          {/*
            SRA A-6. "Remember me" was here, checked by default, and did nothing:
            @supabase/ssr persists the session in cookies regardless of the flag,
            as the comment in `onSubmit` conceded. A checked control that does not
            do what it says is the dead-control defect (F-3) on the most-viewed
            screen in the product. Removed rather than faked — sessions already
            persist, which is the behaviour the checkbox claimed. It comes back
            the day there is a session-scoped cookie for it to actually toggle.
          */}
          <div className="mb-5 mt-3 flex items-center justify-end">
            <Link
              href="/forgot-password"
              className="text-meta font-medium text-primary hover:opacity-80"
            >
              {t("পাসওয়ার্ড ভুলে গেছেন?", "Forgot password?")}
            </Link>
          </div>

          {error ? (
            <div
              className="mb-4 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger-fg"
              role="alert"
            >
              <p>{error}</p>
              {locked ? (
                <p className="mt-1">
                  {t(
                    "অ্যাকাউন্টটি সাময়িকভাবে বন্ধ। কিছুক্ষণ পর আবার চেষ্টা করুন, অথবা প্রতিষ্ঠানের অ্যাডমিনের সাথে যোগাযোগ করুন।",
                    "This account is temporarily locked. Wait a few minutes and try again, or contact your administrator.",
                  )}
                </p>
              ) : null}
            </div>
          ) : null}

          <Button
            type="submit"
            size="lg"
            className="w-full justify-center"
            disabled={loading || !online}
          >
            {loading ? t("লগইন হচ্ছে…", "Signing in…") : t("লগইন", "Sign in")}
          </Button>
        </form>

        {OTP_ENABLED ? (
          <>
            <div className="my-5 flex items-center gap-3 text-xs text-text-muted">
              <span className="h-px flex-1 bg-border-default" />
              {t("অথবা", "or")}
              <span className="h-px flex-1 bg-border-default" />
            </div>

            <Link
              href="/otp"
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-border-strong bg-surface text-sm font-medium text-text-primary transition-colors hover:bg-sunken"
            >
              <Smartphone size={16} />
              {t("ওটিপি দিয়ে লগইন করুন", "Sign in with OTP")}
            </Link>
          </>
        ) : null}
      </AuthCard>
    </AuthShell>
  );
}
