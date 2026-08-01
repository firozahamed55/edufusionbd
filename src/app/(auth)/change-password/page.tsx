"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2 } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import { Button, PasswordInput, PasswordRequirements } from "@/shared/ui";
import { isAcceptable } from "@/shared/lib/passwordPolicy";
import { recordSecurityEvent } from "@/shared/services/security/api";
import { AuthShell, AuthCard, AuthBackLink } from "@/features/auth/components";
import { createClient } from "@/shared/services/supabase/client";

/**
 * Change Password — for a signed-in user: current password + new + confirm,
 * with validation, loading and success states. Role-agnostic.
 */
export default function ChangePasswordPage() {
  const { t } = useT();
  const [current, setCurrent] = useState("");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!current) {
      setError(t("বর্তমান পাসওয়ার্ড দিন", "Enter your current password"));
      return;
    }
    // One policy across Reset, Change and First-Login (SRA B-5). These three
    // screens previously disagreed, so the same account could be given a
    // password one of them would have rejected.
    if (!isAcceptable(pw)) {
      setError(t("নতুন পাসওয়ার্ডটি প্রয়োজনীয় শর্ত পূরণ করে না", "That password does not meet the requirements"));
      return;
    }
    if (pw !== confirm) {
      setError(t("পাসওয়ার্ড দুটি মিলছে না", "Passwords do not match"));
      return;
    }
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) {
      setLoading(false);
      setError(t("সেশনের মেয়াদ শেষ। আবার লগইন করুন।", "Session expired. Please sign in again."));
      return;
    }
    // Verify the current password by re-authenticating before changing it.
    const { error: reauthErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: current,
    });
    if (reauthErr) {
      setLoading(false);
      setError(t("বর্তমান পাসওয়ার্ড ভুল", "Current password is incorrect"));
      return;
    }
    const { error: upErr } = await supabase.auth.updateUser({ password: pw });
    if (!upErr) void recordSecurityEvent(supabase, "auth.password_changed");
    setLoading(false);
    if (upErr) {
      setError(t("পাসওয়ার্ড আপডেট ব্যর্থ হয়েছে", "Could not update password"));
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
          <form onSubmit={onSubmit} noValidate>
            <label className="mb-1.5 block text-meta font-medium text-text-secondary" htmlFor="current">
              {t("বর্তমান পাসওয়ার্ড", "Current password")}
            </label>
            <PasswordInput
              id="current"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              showLabel={t("দেখান", "Show")}
              hideLabel={t("লুকান", "Hide")}
            />

            <label className="mb-1.5 mt-4 block text-meta font-medium text-text-secondary" htmlFor="pw">
              {t("নতুন পাসওয়ার্ড", "New password")}
            </label>
            <PasswordInput
              id="pw"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              showLabel={t("দেখান", "Show")}
              hideLabel={t("লুকান", "Hide")}
            />
            <PasswordRequirements value={pw} className="mt-2" />

            <label className="mb-1.5 mt-4 block text-meta font-medium text-text-secondary" htmlFor="confirm">
              {t("নতুন পাসওয়ার্ড নিশ্চিত করুন", "Confirm new password")}
            </label>
            <PasswordInput
              id="confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              showLabel={t("দেখান", "Show")}
              hideLabel={t("লুকান", "Hide")}
            />

            {error ? (
              <p className="mt-3 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger-fg" role="alert">
                {error}
              </p>
            ) : null}

            <Button type="submit" size="lg" className="mt-5 w-full justify-center" disabled={loading}>
              {loading ? t("সংরক্ষণ হচ্ছে…", "Saving…") : t("পাসওয়ার্ড আপডেট করুন", "Update password")}
            </Button>
          </form>
        )}
      </AuthCard>
    </AuthShell>
  );
}
