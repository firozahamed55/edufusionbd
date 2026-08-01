"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2 } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import { Button, Field, PasswordInput, PasswordRequirements } from "@/shared/ui";
import { isAcceptable } from "@/shared/lib/passwordPolicy";
import { recordSecurityEvent } from "@/shared/services/security/api";
import { AuthShell, AuthCard, AuthBackLink } from "@/features/auth/components";
import { verifyPassword } from "@/features/auth/lib/reauth";
import { createClient } from "@/shared/services/supabase/client";

/**
 * Change Password — for a signed-in user: current password + new + confirm,
 * with validation, loading and success states. Role-agnostic.
 *
 * A-4: three password fields, and the old summary box said only "That password
 * does not meet the requirements" — never WHICH of the three. Each control now
 * carries its own message, wired through `Field` so a screen reader hears it
 * against the input that caused it rather than as a loose alert at the foot.
 */
export default function ChangePasswordPage() {
  const { t } = useT();
  const [current, setCurrent] = useState("");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState<{ current?: string; pw?: string; confirm?: string }>({});
  /** Failures that belong to the request, not to a field (expired session). */
  const [formError, setFormError] = useState<string | null>(null);

  const clear = (k: keyof typeof errors) => setErrors((e) => ({ ...e, [k]: undefined }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!current) next.current = t("বর্তমান পাসওয়ার্ড দিন", "Enter your current password");
    // One policy across Reset, Change and First-Login (SRA B-5). These three
    // screens previously disagreed, so the same account could be given a
    // password one of them would have rejected.
    if (!isAcceptable(pw)) next.pw = t("পাসওয়ার্ডটি প্রয়োজনীয় শর্ত পূরণ করে না", "That password does not meet the requirements");
    if (pw !== confirm) next.confirm = t("পাসওয়ার্ড দুটি মিলছে না", "Passwords do not match");
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) {
      setLoading(false);
      setFormError(t("সেশনের মেয়াদ শেষ। আবার লগইন করুন।", "Session expired. Please sign in again."));
      return;
    }

    // A-5: verified on an isolated client, so confirming the current password
    // no longer mints a session and replace the live one. See lib/reauth.ts.
    if (!(await verifyPassword(user.email, current))) {
      setLoading(false);
      setErrors({ current: t("বর্তমান পাসওয়ার্ড ভুল", "Current password is incorrect") });
      return;
    }

    const { error: upErr } = await supabase.auth.updateUser({ password: pw });
    if (!upErr) void recordSecurityEvent(supabase, "auth.password_changed");
    setLoading(false);
    if (upErr) {
      setFormError(t("পাসওয়ার্ড আপডেট ব্যর্থ হয়েছে", "Could not update password"));
      return;
    }
    setDone(true);
  }

  return (
    <AuthShell>
      <AuthCard
        title={t("পাসওয়ার্ড পরিবর্তন", "Change password")}
        subtitle={t("নিরাপত্তার জন্য বর্তমান পাসওয়ার্ড দিয়ে নিশ্চিত করুন।", "Confirm with your current password for security.")}
        footer={<AuthBackLink label={t("ফিরে যান", "Back")} />}
      >
        {done ? (
          <div className="flex items-center gap-3 rounded-lg bg-success-bg px-4 py-3 text-sm text-success-fg">
            <CheckCircle2 size={18} className="shrink-0" />
            {t("পাসওয়ার্ড সফলভাবে পরিবর্তিত হয়েছে", "Password changed successfully")}
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
            <Field label={t("বর্তমান পাসওয়ার্ড", "Current password")} error={errors.current}>
              <PasswordInput
                id="current"
                value={current}
                onChange={(e) => { setCurrent(e.target.value); clear("current"); }}
                placeholder="••••••••"
                autoComplete="current-password"
                showLabel={t("দেখান", "Show")}
                hideLabel={t("লুকান", "Hide")}
              />
            </Field>

            <Field label={t("নতুন পাসওয়ার্ড", "New password")} error={errors.pw}>
              <PasswordInput
                id="pw"
                value={pw}
                onChange={(e) => { setPw(e.target.value); clear("pw"); }}
                placeholder="••••••••"
                autoComplete="new-password"
                showLabel={t("দেখান", "Show")}
                hideLabel={t("লুকান", "Hide")}
              />
              <PasswordRequirements value={pw} className="mt-2" />
            </Field>

            <Field label={t("নতুন পাসওয়ার্ড নিশ্চিত করুন", "Confirm new password")} error={errors.confirm}>
              <PasswordInput
                id="confirm"
                value={confirm}
                onChange={(e) => { setConfirm(e.target.value); clear("confirm"); }}
                placeholder="••••••••"
                autoComplete="new-password"
                showLabel={t("দেখান", "Show")}
                hideLabel={t("লুকান", "Hide")}
              />
            </Field>

            {formError ? (
              <p className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger-fg" role="alert">
                {formError}
              </p>
            ) : null}

            <Button type="submit" size="lg" className="mt-1 w-full justify-center" disabled={loading}>
              {loading ? t("সংরক্ষণ হচ্ছে…", "Saving…") : t("পাসওয়ার্ড আপডেট করুন", "Update password")}
            </Button>
          </form>
        )}
      </AuthCard>
    </AuthShell>
  );
}
