"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import { Button, PasswordInput } from "@/shared/ui";
import { AuthShell, AuthCard, AuthBackLink } from "@/features/auth/components";
import { createClient } from "@/shared/services/supabase/client";

/** 0–3 strength score from length + character variety. */
function scorePassword(pw: string): number {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

/**
 * Reset Password — set a new password with confirm + live strength meter and
 * match validation, then a success state. Role-agnostic.
 */
export default function ResetPasswordPage() {
  const { t } = useT();
  const params = useSearchParams();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Recovery-link state: exchange the emailed code for a session before we can
  // update the password. `null` = still checking, `true`/`false` = usable link.
  const [linkOk, setLinkOk] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const code = params.get("code");
    if (code) {
      supabase.auth
        .exchangeCodeForSession(code)
        .then(({ error }) => setLinkOk(!error));
      return;
    }
    // No code param — the SDK may already have set a recovery session from the
    // URL hash (older Supabase link format).
    supabase.auth.getSession().then(({ data }) => setLinkOk(!!data.session));
  }, [params]);

  const strength = useMemo(() => scorePassword(pw), [pw]);
  const strengthLabel = [
    t("দুর্বল", "Weak"),
    t("দুর্বল", "Weak"),
    t("মোটামুটি", "Fair"),
    t("শক্তিশালী", "Strong"),
  ][strength];
  const strengthTone = ["bg-danger-fg", "bg-danger-fg", "bg-warning-fg", "bg-success-fg"][strength];

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (pw.length < 8) {
      setError(t("পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে", "Password must be at least 8 characters"));
      return;
    }
    if (pw !== confirm) {
      setError(t("পাসওয়ার্ড দুটি মিলছে না", "Passwords do not match"));
      return;
    }
    setError(null);
    setLoading(true);
    const { error: upErr } = await createClient().auth.updateUser({ password: pw });
    setLoading(false);
    if (upErr) {
      setError(
        t(
          "পাসওয়ার্ড আপডেট করা যায়নি। রিসেট লিংকটির মেয়াদ শেষ হয়ে থাকতে পারে।",
          "Could not update the password. The reset link may have expired.",
        ),
      );
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <AuthShell>
        <AuthCard
          title={t("পাসওয়ার্ড পরিবর্তিত হয়েছে", "Password updated")}
          subtitle={t("এখন নতুন পাসওয়ার্ড দিয়ে লগইন করুন।", "You can now sign in with your new password.")}
        >
          <div className="flex items-center gap-3 rounded-lg bg-success-bg px-4 py-3 text-sm text-success-fg">
            <CheckCircle2 size={18} className="shrink-0" />
            {t("সফলভাবে সম্পন্ন হয়েছে", "All set")}
          </div>
          <a
            href="/login"
            className="mt-5 flex h-11 w-full items-center justify-center rounded-lg bg-primary text-sm font-semibold text-text-on-primary transition-colors hover:bg-primary-hover"
          >
            {t("লগইন করুন", "Go to sign in")}
          </a>
        </AuthCard>
      </AuthShell>
    );
  }

  if (linkOk === false) {
    return (
      <AuthShell>
        <AuthCard
          title={t("লিংকটি অকার্যকর", "Link not valid")}
          subtitle={t(
            "এই পাসওয়ার্ড রিসেট লিংকটির মেয়াদ শেষ বা ব্যবহৃত হয়ে গেছে। নতুন করে অনুরোধ করুন।",
            "This reset link has expired or has already been used. Please request a new one.",
          )}
          footer={<AuthBackLink label={t("লগইনে ফিরে যান", "Back to sign in")} />}
        >
          <div className="flex items-center gap-3 rounded-lg bg-danger-bg px-4 py-3 text-sm text-danger-fg">
            <AlertTriangle size={18} className="shrink-0" />
            {t("রিসেট লিংকটি যাচাই করা যায়নি", "The reset link could not be verified")}
          </div>
          <a
            href="/forgot-password"
            className="mt-5 flex h-11 w-full items-center justify-center rounded-lg bg-primary text-sm font-semibold text-text-on-primary transition-colors hover:bg-primary-hover"
          >
            {t("নতুন লিংক পান", "Request a new link")}
          </a>
        </AuthCard>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <AuthCard
        title={t("নতুন পাসওয়ার্ড", "New password")}
        subtitle={t("একটি শক্তিশালী নতুন পাসওয়ার্ড দিন।", "Choose a strong new password.")}
        footer={<AuthBackLink label={t("লগইনে ফিরে যান", "Back to sign in")} />}
      >
        <form onSubmit={onSubmit} noValidate>
          <label className="mb-1.5 block text-meta font-medium text-text-secondary" htmlFor="pw">
            {t("নতুন পাসওয়ার্ড", "New password")}
          </label>
          <PasswordInput
            id="pw"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="••••••••"
            showLabel={t("পাসওয়ার্ড দেখান", "Show password")}
            hideLabel={t("পাসওয়ার্ড লুকান", "Hide password")}
          />
          {pw ? (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex flex-1 gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors ${i < strength ? strengthTone : "bg-border-strong"}`}
                  />
                ))}
              </div>
              <span className="text-xs text-text-muted">{strengthLabel}</span>
            </div>
          ) : null}

          <label className="mb-1.5 mt-4 block text-meta font-medium text-text-secondary" htmlFor="confirm">
            {t("পাসওয়ার্ড নিশ্চিত করুন", "Confirm password")}
          </label>
          <PasswordInput
            id="confirm"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            showLabel={t("পাসওয়ার্ড দেখান", "Show password")}
            hideLabel={t("পাসওয়ার্ড লুকান", "Hide password")}
          />

          {error ? (
            <p className="mt-3 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger-fg" role="alert">
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            size="lg"
            className="mt-5 w-full justify-center"
            disabled={loading || linkOk === null}
          >
            {loading
              ? t("সংরক্ষণ হচ্ছে…", "Saving…")
              : linkOk === null
                ? t("যাচাই হচ্ছে…", "Verifying link…")
                : t("পাসওয়ার্ড সংরক্ষণ করুন", "Save password")}
          </Button>
        </form>
      </AuthCard>
    </AuthShell>
  );
}
