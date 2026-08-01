"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import { Button, Field, PasswordInput, PasswordRequirements } from "@/shared/ui";
import { isAcceptable } from "@/shared/lib/passwordPolicy";
import { AuthShell, AuthCard, AuthBackLink } from "@/features/auth/components";
import { createClient } from "@/shared/services/supabase/client";

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
  /**
   * A-4: per-field, not one box at the foot. Two password controls, and "that
   * password does not meet the requirements" named neither of them.
   */
  const [errors, setErrors] = useState<{ pw?: string; confirm?: string }>({});
  /** Belongs to the request rather than to a field (an expired reset link). */
  const [formError, setFormError] = useState<string | null>(null);
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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    // The same predicate the checklist renders — a screen cannot accept a
    // password its own requirement list says is not good enough (SRA B-5).
    if (!isAcceptable(pw)) next.pw = t("পাসওয়ার্ডটি প্রয়োজনীয় শর্ত পূরণ করে না", "That password does not meet the requirements");
    if (pw !== confirm) next.confirm = t("পাসওয়ার্ড দুটি মিলছে না", "Passwords do not match");
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    const { error: upErr } = await createClient().auth.updateUser({ password: pw });
    setLoading(false);
    if (upErr) {
      setFormError(
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
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <Field label={t("নতুন পাসওয়ার্ড", "New password")} error={errors.pw}>
            <PasswordInput
              id="pw"
              value={pw}
              onChange={(e) => { setPw(e.target.value); setErrors((s) => ({ ...s, pw: undefined })); }}
              placeholder="••••••••"
              showLabel={t("পাসওয়ার্ড দেখান", "Show password")}
              hideLabel={t("পাসওয়ার্ড লুকান", "Hide password")}
            />
            <PasswordRequirements value={pw} className="mt-2" />
          </Field>

          <Field label={t("পাসওয়ার্ড নিশ্চিত করুন", "Confirm password")} error={errors.confirm}>
            <PasswordInput
              id="confirm"
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); setErrors((s) => ({ ...s, confirm: undefined })); }}
              placeholder="••••••••"
              showLabel={t("পাসওয়ার্ড দেখান", "Show password")}
              hideLabel={t("পাসওয়ার্ড লুকান", "Hide password")}
            />
          </Field>

          {formError ? (
            <p className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger-fg" role="alert">
              {formError}
            </p>
          ) : null}

          <Button
            type="submit"
            size="lg"
            className="mt-1 w-full justify-center"
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
