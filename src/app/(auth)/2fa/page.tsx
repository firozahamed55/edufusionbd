"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck, KeyRound, WifiOff } from "lucide-react";
import { createClient } from "@/shared/services/supabase/client";
import { useT } from "@/shared/i18n/useT";
import { Button, OtpInput, Input, Skeleton } from "@/shared/ui";
import { AuthShell, AuthCard, AuthBackLink } from "@/features/auth/components";
import { roleHome, safeInternalPath } from "@/features/auth/components/roles";
import * as security from "@/shared/services/security/api";
import { useErrorMessage } from "@/shared/services/errors";
import { useOnline } from "@/shared/lib/useOnline";

/**
 * MFA challenge (SRA B-2).
 *
 * Reached after a successful password sign-in when the account has a verified
 * TOTP factor and the session is still `aal1`. The gate is Supabase's own
 * assurance level, not a flag this app keeps — an app-level check is a check
 * an attacker skips by not visiting this page.
 *
 * The recovery path deliberately does NOT hand out a session. A recovery code
 * removes the lost factor so the user can sign in with their password alone
 * and enrol a new authenticator; minting a session outside GoTrue to make the
 * flow one step shorter would be a far worse thing to build.
 */
export default function TwoFactorPage() {
  return (
    <Suspense fallback={<AuthShell><AuthCard title=""><Skeleton className="h-40" /></AuthCard></AuthShell>}>
      <TwoFactor />
    </Suspense>
  );
}

function TwoFactor() {
  const { t } = useT();
  const msg = useErrorMessage();
  const router = useRouter();
  const params = useSearchParams();
  const online = useOnline();

  const [factorId, setFactorId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      try {
        const [factors, aal] = await Promise.all([
          security.listFactors(supabase),
          security.assuranceLevel(supabase),
        ]);
        const verified = factors.find((f) => f.status === "verified");
        // Already at aal2, or nothing to challenge — either way this screen has
        // no job. Sending the user on beats showing an input that does nothing.
        if (!verified || aal.current === "aal2") {
          const { data } = await supabase.auth.getUser();
          router.replace(
            safeInternalPath(params.get("redirect")) ?? roleHome(data.user?.app_metadata?.role as string | undefined),
          );
          return;
        }
        setFactorId(verified.id);
      } catch {
        setError(t("যাচাইকরণ শুরু করা যায়নি", "Could not start verification"));
      } finally {
        setChecking(false);
      }
    })();
  }, [router, params, t]);

  async function submitCode() {
    if (!factorId || code.length !== 6) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    try {
      await security.verifyTotp(supabase, factorId, code);
      await security.recordSecurityEvent(supabase, "auth.sign_in");
      const { data } = await supabase.auth.getUser();
      router.replace(
        safeInternalPath(params.get("redirect")) ?? roleHome(data.user?.app_metadata?.role as string | undefined),
      );
      router.refresh();
    } catch (e) {
      setAttempts((a) => a + 1);
      setCode("");
      await security.recordSecurityEvent(supabase, "mfa.challenge_failed").catch(() => {});
      setError(msg(e, { bn: "কোডটি ভুল বা মেয়াদোত্তীর্ণ", en: "That code is wrong or has expired" }));
    } finally {
      setBusy(false);
    }
  }

  async function submitRecovery() {
    if (recovery.trim().length < 6) return;
    setBusy(true);
    setError(null);
    try {
      const ok = await security.consumeRecoveryCode(createClient(), recovery);
      if (!ok) {
        setError(t("রিকভারি কোডটি সঠিক নয় বা ব্যবহৃত হয়ে গেছে", "That recovery code is not valid, or has been used"));
        return;
      }
      // The factor is gone; the existing aal1 session is now sufficient.
      router.replace("/admin/account?tab=security&mfa=reset");
      router.refresh();
    } catch (e) {
      setError(msg(e, { bn: "রিকভারি ব্যর্থ", en: "Recovery failed" }));
    } finally {
      setBusy(false);
    }
  }

  if (checking) {
    return (
      <AuthShell>
        <AuthCard title={t("যাচাই হচ্ছে…", "Verifying…")}>
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-11" />)}
          </div>
        </AuthCard>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <AuthCard
        title={useRecovery ? t("রিকভারি কোড", "Recovery code") : t("দুই-ধাপ যাচাইকরণ", "Two-step verification")}
        subtitle={
          useRecovery
            ? t(
                "আপনার সংরক্ষিত রিকভারি কোডগুলোর একটি দিন। এটি ব্যবহার করলে বর্তমান অথেন্টিকেটরটি সরে যাবে এবং আপনাকে নতুন করে সেটআপ করতে হবে।",
                "Enter one of your saved recovery codes. Using one removes the current authenticator, and you will set up a new one.",
              )
            : t(
                "আপনার অথেন্টিকেটর অ্যাপে দেখানো ৬-সংখ্যার কোডটি দিন।",
                "Enter the 6-digit code from your authenticator app.",
              )
        }
        footer={<AuthBackLink label={t("লগইনে ফিরে যান", "Back to sign in")} />}
      >
        {!online ? (
          <p className="mb-4 flex items-center gap-2 rounded-lg bg-warning-bg px-3 py-2 text-sm text-warning-fg" role="status">
            <WifiOff size={16} /> {t("ইন্টারনেট সংযোগ নেই — যাচাই করা যাবে না।", "You are offline — verification needs a connection.")}
          </p>
        ) : null}

        {useRecovery ? (
          <>
            <label className="mb-1.5 block text-meta font-medium text-text-secondary" htmlFor="recovery">
              {t("রিকভারি কোড", "Recovery code")}
            </label>
            <Input
              id="recovery"
              value={recovery}
              onChange={(e) => setRecovery(e.target.value)}
              placeholder="A1B2C3D4E5"
              autoComplete="one-time-code"
              className="font-latin tracking-widest"
            />
          </>
        ) : (
          <div className="flex justify-center">
            <OtpInput
              value={code}
              onChange={setCode}
              ariaLabel={t("ছয় সংখ্যার কোড", "Six digit code")}
              disabled={busy || !online}
            />
          </div>
        )}

        {error ? (
          <p className="mt-4 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger-fg" role="alert">
            {error}
            {attempts >= 3 ? (
              <span className="mt-1 block">
                {t(
                  "অথেন্টিকেটরের ঘড়ি ঠিক আছে কিনা দেখুন, অথবা রিকভারি কোড ব্যবহার করুন।",
                  "Check your authenticator's clock, or use a recovery code.",
                )}
              </span>
            ) : null}
          </p>
        ) : null}

        <Button
          size="lg"
          className="mt-5 w-full justify-center"
          disabled={busy || !online || (useRecovery ? recovery.trim().length < 6 : code.length !== 6)}
          onClick={() => (useRecovery ? void submitRecovery() : void submitCode())}
        >
          {busy ? t("যাচাই হচ্ছে…", "Verifying…") : t("যাচাই করুন", "Verify")}
        </Button>

        <button
          type="button"
          onClick={() => { setUseRecovery((v) => !v); setError(null); }}
          className="mt-4 flex w-full items-center justify-center gap-2 text-meta font-medium text-primary hover:opacity-80"
        >
          {useRecovery ? <ShieldCheck size={15} /> : <KeyRound size={15} />}
          {useRecovery
            ? t("অথেন্টিকেটর কোড ব্যবহার করুন", "Use an authenticator code instead")
            : t("অথেন্টিকেটর হারিয়েছেন? রিকভারি কোড দিন", "Lost your authenticator? Use a recovery code")}
        </button>
      </AuthCard>
    </AuthShell>
  );
}
