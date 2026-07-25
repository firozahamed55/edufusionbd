"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Smartphone } from "lucide-react";
import { createClient } from "@/shared/services/supabase/client";
import { resolveLoginEmail } from "@/features/auth/lib/identity";
import { useT } from "@/shared/i18n/useT";
import { Button, PasswordInput, Checkbox } from "@/shared/ui";
import { AuthShell, AuthCard } from "@/features/auth/components";
import { roleHome, isRole, safeInternalPath, ROLE_LABELS } from "@/features/auth/components/roles";
import { useErrorMessage } from "@/shared/services/errors";

/**
 * Login — Figma split-panel. Primary identifier is a mobile number (how
 * Bangladeshi parents log in); an email is also accepted so the existing
 * Supabase email/password flow keeps working (audit 7.2). Includes remember-me,
 * show/hide password, forgot-password link, an OTP-login path, field-level
 * validation, and loading/error states.
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
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    // ponytail: @supabase/ssr persists the session in cookies regardless of
    // `remember`, so the toggle is a UX affordance today. Wire a session-scoped
    // cookie override here if true "forget on close" is required.
    const { data, error } = await supabase.auth.signInWithPassword({
      email: resolveLoginEmail(identifier),
      password,
    });
    if (error) {
      setLoading(false);
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
    const actualRole = (data.user?.app_metadata?.role ?? data.user?.user_metadata?.role) as
      | string
      | undefined;
    // Honor a safe internal deep-link (middleware sets ?redirect=…), else land
    // on the dashboard for the user's REAL role. External redirects are rejected.
    const dest = safeInternalPath(params.get("redirect")) ?? roleHome(actualRole);
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
        <form onSubmit={onSubmit} noValidate>
          <label
            className="mb-1.5 block text-meta font-medium text-text-secondary"
            htmlFor="identifier"
          >
            {t("মোবাইল নম্বর", "Mobile number")}
          </label>
          <input
            id="identifier"
            type="text"
            inputMode="tel"
            required
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="mb-4 h-10.5 w-full rounded-lg border border-border-strong bg-surface px-3 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-primary tnum"
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

          <div className="mb-5 mt-3 flex items-center justify-between">
            <label className="flex items-center gap-2 text-meta text-text-secondary">
              <Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              {t("আমাকে মনে রাখুন", "Remember me")}
            </label>
            <Link
              href="/forgot-password"
              className="text-meta font-medium text-primary hover:opacity-80"
            >
              {t("পাসওয়ার্ড ভুলে গেছেন?", "Forgot password?")}
            </Link>
          </div>

          {error ? (
            <p
              className="mb-4 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger-fg"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <Button type="submit" size="lg" className="w-full justify-center" disabled={loading}>
            {loading ? t("লগইন হচ্ছে…", "Signing in…") : t("লগইন", "Sign in")}
          </Button>
        </form>

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
      </AuthCard>
    </AuthShell>
  );
}
