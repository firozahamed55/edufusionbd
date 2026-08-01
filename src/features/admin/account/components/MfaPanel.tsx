"use client";

import { useState } from "react";
import { ShieldCheck, ShieldAlert, KeyRound, Copy, Printer, Trash2 } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import {
  Button, Field, Input, OtpInput, PasswordInput, Modal, Badge, Skeleton, useToast,
} from "@/shared/ui";
import { createClient } from "@/shared/services/supabase/client";
import {
  useMfaFactors, useAssuranceLevel, useRecoveryCodeCount,
  useEnrollTotp, useVerifyTotp, useUnenrollTotp, useGenerateRecoveryCodes,
} from "@/shared/services/security/hooks";
import { reauthenticate } from "@/shared/services/security/api";
import { useErrorMessage } from "@/shared/services/errors";

/* eslint-disable @next/next/no-img-element -- the QR is an inline SVG data URI
   minted by Supabase for this enrolment; there is no remote asset to optimise. */

/**
 * TOTP enrolment and management (SRA B-2).
 *
 * "MFA is a standard line item on institutional security questionnaires. Its
 * absence is a procurement blocker at any buyer with an IT function, and a
 * defensibility problem for a system holding children's data."
 *
 * Verify-before-enable: Supabase leaves a factor `unverified` until a code
 * from it is accepted, so a mistyped secret cannot lock the account out.
 * Recovery codes are shown exactly once, and unenrolment requires the password
 * — otherwise anyone who finds an unlocked machine can remove the second
 * factor and leave with a password-only account.
 */
export function MfaPanel() {
  const { t, n } = useT();
  const msg = useErrorMessage();
  const toast = useToast();

  const factors = useMfaFactors();
  const aal = useAssuranceLevel();
  const recoveryCount = useRecoveryCodeCount();
  const enroll = useEnrollTotp();
  const verify = useVerifyTotp();
  const unenrollFactor = useUnenrollTotp();
  const generateCodes = useGenerateRecoveryCodes();

  const [step, setStep] = useState<"idle" | "scan" | "codes">("idle");
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [removing, setRemoving] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const verified = (factors.data ?? []).filter((f) => f.status === "verified");
  const enabled = verified.length > 0;
  const enrolment = enroll.data;

  async function startEnrolment() {
    setError(null);
    setCode("");
    // A stale `unverified` factor from an abandoned attempt blocks a new
    // enrolment with "factor already exists"; clear them first.
    const stale = (factors.data ?? []).filter((f) => f.status === "unverified");
    for (const f of stale) await unenrollFactor.mutateAsync(f.id).catch(() => {});
    enroll.mutate(t("অথেন্টিকেটর", "Authenticator"), {
      onSuccess: () => setStep("scan"),
      onError: (e: unknown) => toast({ title: msg(e, { bn: "শুরু করা যায়নি", en: "Could not start" }), variant: "error" }),
    });
  }

  function confirmEnrolment() {
    if (!enrolment || code.length !== 6) return;
    setError(null);
    verify.mutate({ factorId: enrolment.factorId, code }, {
      onSuccess: () => {
        generateCodes.mutate(undefined, {
          onSuccess: (fresh) => { setCodes(fresh as string[]); setStep("codes"); },
          onError: () => { setStep("idle"); toast({ title: t("চালু হয়েছে, তবে রিকভারি কোড তৈরি হয়নি", "Enabled, but recovery codes were not created"), variant: "error" }); },
        });
      },
      onError: (e: unknown) => { setCode(""); setError(msg(e, { bn: "কোডটি ভুল বা মেয়াদোত্তীর্ণ", en: "That code is wrong or has expired" })); },
    });
  }

  async function removeFactor() {
    if (!removing) return;
    setError(null);
    const ok = await reauthenticate(createClient(), password);
    if (!ok) { setError(t("পাসওয়ার্ড ভুল", "Wrong password")); return; }
    unenrollFactor.mutate(removing, {
      onSuccess: () => { setRemoving(null); setPassword(""); toast({ title: t("দুই-ধাপ যাচাইকরণ বন্ধ হয়েছে", "Two-step verification turned off"), variant: "success" }); },
      onError: (e: unknown) => setError(msg(e, { bn: "বন্ধ করা যায়নি", en: "Could not turn it off" })),
    });
  }

  function regenerate() {
    generateCodes.mutate(undefined, {
      onSuccess: (fresh) => { setCodes(fresh as string[]); setStep("codes"); },
      onError: (e: unknown) => toast({ title: msg(e, { bn: "তৈরি ব্যর্থ", en: "Could not generate" }), variant: "error" }),
    });
  }

  if (factors.isLoading) {
    return <div className="flex flex-col gap-2">{[0, 1].map((i) => <Skeleton key={i} className="h-16" />)}</div>;
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-surface p-6 shadow-e1">
      <header className="flex flex-wrap items-center gap-3">
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", enabled ? "bg-success-bg text-success-fg" : "bg-warning-bg text-warning-fg")}>
          {enabled ? <ShieldCheck size={20} /> : <ShieldAlert size={20} />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-text-primary">{t("দুই-ধাপ যাচাইকরণ", "Two-step verification")}</h2>
          <p className="text-meta text-text-muted">
            {enabled
              ? t("লগইনের সময় অথেন্টিকেটর কোড চাওয়া হবে।", "An authenticator code is required at sign-in.")
              : t("শুধু পাসওয়ার্ড দিয়েই এই অ্যাকাউন্টে ঢোকা যায়।", "This account is protected by a password alone.")}
          </p>
        </div>
        {enabled ? <Badge tone="success" dot>{t("চালু", "On")}</Badge> : <Badge tone="warning" dot>{t("বন্ধ", "Off")}</Badge>}
      </header>

      {aal.data?.next === "aal2" && aal.data.current !== "aal2" ? (
        <p className="rounded-lg bg-warning-bg px-3 py-2 text-meta text-warning-fg" role="status">
          {t("এই সেশনটি এখনও দ্বিতীয় ধাপ পার করেনি।", "This session has not yet completed the second step.")}
        </p>
      ) : null}

      {enabled ? (
        <>
          <ul className="flex flex-col gap-2">
            {verified.map((f) => (
              <li key={f.id} className="flex items-center gap-3 rounded-lg border border-border-default px-3 py-2.5">
                <KeyRound size={16} className="shrink-0 text-text-muted" />
                <span className="min-w-0 flex-1 truncate text-meta text-text-primary">
                  {f.friendlyName ?? t("অথেন্টিকেটর", "Authenticator")}
                </span>
                <Button variant="ghost" onClick={() => { setRemoving(f.id); setError(null); }}>
                  <Trash2 size={15} /> {t("সরান", "Remove")}
                </Button>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-sunken px-3 py-2.5">
            <span className="min-w-0 flex-1 text-meta text-text-secondary">
              {t(
                `${n(recoveryCount.data ?? 0)}টি রিকভারি কোড অবশিষ্ট`,
                `${recoveryCount.data ?? 0} recovery codes remaining`,
              )}
            </span>
            <Button variant="secondary" onClick={regenerate} disabled={generateCodes.isPending}>
              {t("নতুন কোড তৈরি করুন", "Generate new codes")}
            </Button>
          </div>
        </>
      ) : (
        <Button variant="primary" className="self-start" onClick={() => void startEnrolment()} disabled={enroll.isPending}>
          <ShieldCheck size={16} /> {enroll.isPending ? t("শুরু হচ্ছে…", "Starting…") : t("চালু করুন", "Turn on")}
        </Button>
      )}

      {/* --- enrolment: scan --- */}
      <Modal
        open={step === "scan"}
        onClose={() => setStep("idle")}
        title={t("অথেন্টিকেটর যুক্ত করুন", "Add your authenticator")}
        description={t(
          "Google Authenticator বা অনুরূপ অ্যাপে QR স্ক্যান করুন, তারপর দেখানো ৬-সংখ্যার কোডটি দিন।",
          "Scan the QR in Google Authenticator or similar, then enter the 6-digit code it shows.",
        )}
        className="max-w-md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setStep("idle")}>{t("বাতিল", "Cancel")}</Button>
            <Button variant="primary" onClick={confirmEnrolment} disabled={code.length !== 6 || verify.isPending}>
              {verify.isPending ? t("যাচাই হচ্ছে…", "Verifying…") : t("যাচাই ও চালু করুন", "Verify and turn on")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col items-center gap-4">
          {enrolment ? (
            <>
              <img src={enrolment.qrSvg} alt={t("QR কোড", "QR code")} className="size-44 rounded-lg bg-white p-2" />
              {/* The secret in text as well as the QR: a desktop authenticator
                  and a screen-reader user both need it, and A-0.7's standard
                  does not stop at the auth screens. */}
              <Field label={t("অথবা এই কোডটি হাতে লিখুন", "Or enter this key by hand")} className="w-full">
                <Input readOnly value={enrolment.secret} className="font-latin tracking-wider" onFocus={(e) => e.currentTarget.select()} />
              </Field>
              <button
                type="button"
                onClick={() => { void navigator.clipboard.writeText(enrolment.secret); toast({ title: t("কপি হয়েছে", "Copied"), variant: "success" }); }}
                className="flex items-center gap-1.5 text-meta font-medium text-primary hover:opacity-80"
              >
                <Copy size={14} /> {t("কপি করুন", "Copy key")}
              </button>
              <OtpInput value={code} onChange={setCode} ariaLabel={t("ছয় সংখ্যার কোড", "Six digit code")} disabled={verify.isPending} />
            </>
          ) : (
            <Skeleton className="size-44" />
          )}
          {error ? <p role="alert" className="w-full rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger-fg">{error}</p> : null}
        </div>
      </Modal>

      {/* --- enrolment: recovery codes, shown once --- */}
      <Modal
        open={step === "codes"}
        onClose={() => setStep("idle")}
        title={t("রিকভারি কোড সংরক্ষণ করুন", "Save your recovery codes")}
        description={t(
          "ফোন হারালে এই কোডগুলোই একমাত্র উপায়। প্রতিটি একবার ব্যবহারযোগ্য এবং এই কোডগুলো আর কখনও দেখানো হবে না।",
          "If you lose your phone, these are the only way back in. Each works once, and they will never be shown again.",
        )}
        className="max-w-md"
        footer={<Button variant="primary" onClick={() => setStep("idle")}>{t("সংরক্ষণ করেছি", "I have saved them")}</Button>}
      >
        <div className="flex flex-col gap-3">
          <ul className="grid grid-cols-2 gap-2 rounded-lg bg-sunken p-3 font-latin text-meta tracking-wider">
            {codes.map((c) => <li key={c} className="tnum">{c}</li>)}
          </ul>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => { void navigator.clipboard.writeText(codes.join("\n")); toast({ title: t("কপি হয়েছে", "Copied"), variant: "success" }); }}
            >
              <Copy size={15} /> {t("কপি", "Copy")}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                // A download, not a print dialog: a school office machine is
                // often not attached to a working printer, and losing these is
                // losing the account.
                const blob = new Blob([codes.join("\n")], { type: "text/plain" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "edufusionbd-recovery-codes.txt";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Printer size={15} /> {t("ডাউনলোড", "Download")}
            </Button>
          </div>
        </div>
      </Modal>

      {/* --- removal: password re-auth --- */}
      <Modal
        open={!!removing}
        onClose={() => { setRemoving(null); setPassword(""); setError(null); }}
        title={t("দুই-ধাপ যাচাইকরণ বন্ধ করবেন?", "Turn off two-step verification?")}
        description={t(
          "এরপর শুধু পাসওয়ার্ড দিয়েই এই অ্যাকাউন্টে ঢোকা যাবে। নিশ্চিত করতে বর্তমান পাসওয়ার্ড দিন।",
          "The account will be protected by a password alone. Enter your current password to confirm.",
        )}
        className="max-w-sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setRemoving(null); setPassword(""); }}>{t("বাতিল", "Cancel")}</Button>
            <Button variant="danger" onClick={() => void removeFactor()} disabled={!password || unenrollFactor.isPending}>
              {t("বন্ধ করুন", "Turn off")}
            </Button>
          </>
        }
      >
        <Field label={t("বর্তমান পাসওয়ার্ড", "Current password")} error={error ?? undefined}>
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            showLabel={t("দেখান", "Show")}
            hideLabel={t("লুকান", "Hide")}
          />
        </Field>
      </Modal>
    </section>
  );
}
