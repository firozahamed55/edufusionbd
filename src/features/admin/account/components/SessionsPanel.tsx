"use client";

import { Monitor, Smartphone, LogOut } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { formatDateTime } from "@/shared/lib/format";
import { Button, Badge, Skeleton, ErrorState, useToast } from "@/shared/ui";
import { useSessions, useRevokeSession, useSecurityEvents } from "@/shared/services/security/hooks";
import { useErrorMessage } from "@/shared/services/errors";

/** Coarse device label from the UA string. Not fingerprinting — the point is
 *  to help someone recognise "that is not my laptop", nothing more. */
function describeAgent(ua: string | null): { label: string; mobile: boolean } {
  if (!ua) return { label: "Unknown device", mobile: false };
  const mobile = /Mobi|Android|iPhone|iPad/i.test(ua);
  const browser =
    /Edg\//.test(ua) ? "Edge"
    : /OPR\//.test(ua) ? "Opera"
    : /Chrome\//.test(ua) ? "Chrome"
    : /Firefox\//.test(ua) ? "Firefox"
    : /Safari\//.test(ua) ? "Safari"
    : "Browser";
  const os =
    /Windows/.test(ua) ? "Windows"
    : /Android/.test(ua) ? "Android"
    : /iPhone|iPad|iOS/.test(ua) ? "iOS"
    : /Mac OS X/.test(ua) ? "macOS"
    : /Linux/.test(ua) ? "Linux"
    : "";
  return { label: [browser, os].filter(Boolean).join(" · "), mobile };
}

/**
 * Active sessions and the security event log (SRA B-3).
 *
 * "A session on a shared school computer persists indefinitely. A user who
 * suspects compromise has no action available except changing their password,
 * and even that does not visibly kill other sessions."
 */
export function SessionsPanel() {
  const { t, n, isBn } = useT();
  const msg = useErrorMessage();
  const toast = useToast();
  const sessions = useSessions();
  const events = useSecurityEvents(25);
  const revoke = useRevokeSession();

  const rows = sessions.data ?? [];
  const others = rows.filter((s) => !s.current);

  function revokeOne(id: string | null) {
    revoke.mutate(id, {
      onSuccess: (count) =>
        toast({
          title: t(`${n(count as number)}টি সেশন বন্ধ হয়েছে`, `${count} session(s) signed out`),
          variant: "success",
        }),
      onError: (e: unknown) => toast({ title: msg(e, { bn: "বন্ধ করা যায়নি", en: "Could not sign out" }), variant: "error" }),
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-4 rounded-2xl bg-surface p-6 shadow-e1">
        <header className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-text-primary">{t("সক্রিয় সেশন", "Active sessions")}</h2>
            <p className="text-meta text-text-muted">
              {t("আপনি কোথায় কোথায় লগইন আছেন", "Where you are currently signed in")}
            </p>
          </div>
          {others.length > 0 ? (
            <Button variant="secondary" onClick={() => revokeOne(null)} disabled={revoke.isPending}>
              <LogOut size={15} /> {t("অন্য সব সেশন বন্ধ করুন", "Sign out everywhere else")}
            </Button>
          ) : null}
        </header>

        {sessions.isLoading ? (
          <div className="flex flex-col gap-2">{[0, 1].map((i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : sessions.isError ? (
          <ErrorState title={t("সেশন লোড করা যায়নি", "Could not load sessions")} />
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((s) => {
              const device = describeAgent(s.user_agent);
              return (
                <li
                  key={s.id}
                  className={cn(
                    "flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5",
                    s.current ? "border-primary bg-primary-subtle" : "border-border-default",
                  )}
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-sunken text-text-secondary">
                    {device.mobile ? <Smartphone size={16} /> : <Monitor size={16} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-meta font-medium text-text-primary">{device.label}</p>
                    <p className="truncate text-micro text-text-muted">
                      {s.ip ? `${s.ip} · ` : ""}
                      {t("সর্বশেষ", "Last active")} {formatDateTime(s.last_active)}
                    </p>
                  </div>
                  {s.current ? (
                    <Badge tone="primary" dot>{t("এই ডিভাইস", "This device")}</Badge>
                  ) : (
                    <Button variant="ghost" onClick={() => revokeOne(s.id)} disabled={revoke.isPending}>
                      {t("বন্ধ করুন", "Sign out")}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* Honest about what revocation actually does. GoTrue invalidates the
            refresh token immediately; the access token already issued lives out
            its hour. Saying "signed out" without this would be a promise the
            system does not keep. */}
        <p className="text-micro text-text-muted">
          {t(
            "সেশন বন্ধ করলে সেই ডিভাইসের রিফ্রেশ টোকেন সঙ্গে সঙ্গে বাতিল হয়; ইতিমধ্যে ইস্যু হওয়া অ্যাক্সেস টোকেন সর্বোচ্চ এক ঘণ্টা পর্যন্ত চলতে পারে।",
            "Signing out a session revokes its refresh token immediately; an access token already issued can remain valid for up to an hour.",
          )}
        </p>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl bg-surface p-6 shadow-e1">
        <h2 className="text-base font-semibold text-text-primary">{t("নিরাপত্তা কার্যক্রম", "Security activity")}</h2>
        {events.isLoading ? (
          <div className="flex flex-col gap-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-9" />)}</div>
        ) : (events.data ?? []).length === 0 ? (
          <p className="text-meta text-text-muted">{t("এখনও কোনো কার্যক্রম নেই", "No activity yet")}</p>
        ) : (
          <ul className="flex flex-col">
            {(events.data ?? []).map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline gap-2 border-b border-border-default py-2 last:border-0">
                <span className="text-meta font-medium text-text-primary">
                  {EVENT_LABELS[e.action ?? ""]?.[isBn ? 0 : 1] ?? e.action}
                </span>
                <span className="text-micro text-text-muted">{formatDateTime(e.at)}</span>
                {e.ip ? <span className="text-micro text-text-muted">· {e.ip}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** `[bn, en]` per recorded action. An unknown action prints its raw code
 *  rather than being hidden — a security log that silently drops events it
 *  does not recognise is worse than one with an ugly row in it. */
const EVENT_LABELS: Record<string, [string, string]> = {
  "auth.sign_in": ["লগইন", "Signed in"],
  "auth.sign_out": ["লগআউট", "Signed out"],
  "auth.password_changed": ["পাসওয়ার্ড পরিবর্তন", "Password changed"],
  "auth.step_up": ["পুনঃযাচাই", "Re-authenticated"],
  "mfa.enrolled": ["দুই-ধাপ চালু", "Two-step enabled"],
  "mfa.unenrolled": ["দুই-ধাপ বন্ধ", "Two-step disabled"],
  "mfa.challenge_failed": ["ভুল কোড", "Failed verification code"],
  "mfa.recovery_codes_generated": ["রিকভারি কোড তৈরি", "Recovery codes generated"],
  "mfa.recovery_code_used": ["রিকভারি কোড ব্যবহৃত", "Recovery code used"],
  "mfa.recovery_code_rejected": ["ভুল রিকভারি কোড", "Invalid recovery code"],
  "mfa.reset_by_admin": ["অ্যাডমিন দুই-ধাপ রিসেট করেছেন", "MFA reset by an administrator"],
  "session.revoke": ["সেশন বন্ধ", "Session signed out"],
  "session.revoke_others": ["অন্য সব সেশন বন্ধ", "All other sessions signed out"],
};
