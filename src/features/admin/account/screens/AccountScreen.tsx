"use client";

import { useEffect, useState } from "react";
import { UserRound, ShieldCheck, Settings2 } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { formatDateTime } from "@/shared/lib/format";
import {
  PageHeader, Field, Input, Button, Badge, Skeleton, ErrorState, SaveBar, UnsavedDot, useToast,
} from "@/shared/ui";
import { useQueryState } from "@/shared/lib/useQueryState";
import { useMyProfile, useUpdateMyProfile } from "@/shared/services/security/hooks";
import { useErrorMessage } from "@/shared/services/errors";
import { MfaPanel } from "../components/MfaPanel";
import { SessionsPanel } from "../components/SessionsPanel";
import { PreferencesPanel } from "../components/PreferencesPanel";

const TABS = ["profile", "security", "preferences"] as const;
type Tab = (typeof TABS)[number];

/**
 * My Account (SRA B-4).
 *
 * "The profile menu's প্রোফাইল / Profile item links to /admin/core/user-list —
 * a LIST OF EVERY USER IN THE INSTITUTION, not the signed-in user's own
 * account." The menu item was wired to the nearest existing route, and there
 * was nowhere at all to change one's own name, phone or preferences, let alone
 * manage MFA or sessions.
 *
 * Tab lives in the URL so "open my security settings" is a link — the /2fa
 * recovery path lands directly on ?tab=security.
 */
export function AccountScreen() {
  const { t } = useT();
  const msg = useErrorMessage();
  const toast = useToast();
  const [q, setQ] = useQueryState({ tab: "profile" as string, mfa: "" });
  const tab = (TABS as readonly string[]).includes(q.tab) ? (q.tab as Tab) : "profile";

  const profile = useMyProfile();
  const update = useUpdateMyProfile();
  const [form, setForm] = useState<{ full_name: string; phone: string } | null>(null);

  useEffect(() => {
    if (profile.data && !form) {
      setForm({ full_name: profile.data.full_name ?? "", phone: profile.data.phone ?? "" });
    }
  }, [profile.data, form]);

  // Arriving here from a spent recovery code: say plainly what happened, or
  // the user is on a security screen with no idea why.
  useEffect(() => {
    if (q.mfa === "reset") {
      toast({
        title: t(
          "রিকভারি কোড ব্যবহৃত হয়েছে — দুই-ধাপ যাচাইকরণ সরানো হয়েছে। আবার চালু করুন।",
          "Recovery code used — two-step verification was removed. Set it up again.",
        ),
        variant: "success",
      });
      setQ({ mfa: "" });
    }
  }, [q.mfa]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty =
    !!form && !!profile.data &&
    (form.full_name !== (profile.data.full_name ?? "") || form.phone !== (profile.data.phone ?? ""));

  function save() {
    if (!form) return;
    update.mutate(form, {
      onSuccess: () => toast({ title: t("সংরক্ষিত হয়েছে", "Saved"), variant: "success" }),
      onError: (e: unknown) => toast({ title: msg(e, { bn: "সংরক্ষণ ব্যর্থ", en: "Save failed" }), variant: "error" }),
    });
  }

  const TAB_META: Record<Tab, { icon: typeof UserRound; bn: string; en: string }> = {
    profile: { icon: UserRound, bn: "প্রোফাইল", en: "Profile" },
    security: { icon: ShieldCheck, bn: "নিরাপত্তা", en: "Security" },
    preferences: { icon: Settings2, bn: "পছন্দ", en: "Preferences" },
  };

  return (
    <div className="flex flex-col gap-5 pb-6">
      <PageHeader
        crumbs={[{ label: t("আমার অ্যাকাউন্ট", "My Account") }]}
        title={t("আমার অ্যাকাউন্ট", "My Account")}
        subtitle={t("আপনার নিজের তথ্য, নিরাপত্তা ও পছন্দ", "Your own details, security and preferences")}
      />

      <nav className="flex flex-wrap gap-1 border-b border-border-default" aria-label={t("অ্যাকাউন্ট বিভাগ", "Account sections")}>
        {TABS.map((key) => {
          const meta = TAB_META[key];
          const Icon = meta.icon;
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => setQ({ tab: key })}
              className={cn(
                "-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-meta font-medium transition-colors",
                active ? "border-primary text-primary" : "border-transparent text-text-secondary hover:text-text-primary",
              )}
            >
              <Icon size={15} /> {t(meta.bn, meta.en)}
            </button>
          );
        })}
      </nav>

      {profile.isLoading ? (
        <div className="flex flex-col gap-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : profile.isError ? (
        <ErrorState title={t("অ্যাকাউন্ট লোড করা যায়নি", "Could not load your account")} />
      ) : tab === "profile" ? (
        <>
          <section className="flex flex-col gap-4 rounded-2xl bg-surface p-6 shadow-e1">
            <h2 className="text-base font-semibold text-text-primary">{t("আপনার তথ্য", "Your details")}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t("পূর্ণ নাম", "Full name")}>
                <Input value={form?.full_name ?? ""} onChange={(e) => setForm((p) => ({ ...(p ?? { full_name: "", phone: "" }), full_name: e.target.value }))} />
              </Field>
              <Field label={t("মোবাইল নম্বর", "Mobile number")}>
                <Input value={form?.phone ?? ""} onChange={(e) => setForm((p) => ({ ...(p ?? { full_name: "", phone: "" }), phone: e.target.value }))} className="font-latin" />
              </Field>
              {/* Email, role and status are read-only here on purpose. Changing
                  an email is an identity change GoTrue owns and must confirm;
                  role and status are RBAC decisions that would be worthless if
                  the subject could edit them. */}
              <Field label={t("ইমেইল", "Email")}>
                <Input value={profile.data?.email ?? ""} readOnly disabled className="font-latin" />
              </Field>
              <Field label={t("ভূমিকা", "Roles")}>
                <div className="flex min-h-10.5 flex-wrap items-center gap-2">
                  {(profile.data?.roles ?? []).length === 0 ? (
                    <span className="text-meta text-text-muted">—</span>
                  ) : (
                    (profile.data?.roles ?? []).map((r) => <Badge key={r} tone="primary">{r.replace(/_/g, " ")}</Badge>)
                  )}
                </div>
              </Field>
            </div>
            <p className="text-micro text-text-muted">
              {t("সর্বশেষ লগইন", "Last sign-in")}:{" "}
              {profile.data?.last_login_at ? formatDateTime(profile.data.last_login_at) : t("তথ্য নেই", "unknown")}
              {" · "}
              {t("ইমেইল বা ভূমিকা পরিবর্তনের জন্য প্রতিষ্ঠানের অ্যাডমিনের সাথে যোগাযোগ করুন।", "To change your email or roles, contact your administrator.")}
            </p>
          </section>

          <SaveBar
            status={
              <>
                {dirty ? <UnsavedDot /> : null}
                <span>{dirty ? t("অসংরক্ষিত পরিবর্তন আছে", "Unsaved changes") : t("আমার অ্যাকাউন্ট", "My account")}</span>
              </>
            }
          >
            <Button
              variant="secondary"
              disabled={!dirty || update.isPending}
              onClick={() => setForm({ full_name: profile.data?.full_name ?? "", phone: profile.data?.phone ?? "" })}
            >
              {t("বাতিল", "Reset")}
            </Button>
            <Button variant="primary" onClick={save} disabled={!dirty || update.isPending}>
              {update.isPending ? t("সংরক্ষণ হচ্ছে…", "Saving…") : t("সংরক্ষণ করুন", "Save")}
            </Button>
          </SaveBar>
        </>
      ) : tab === "security" ? (
        <div className="flex flex-col gap-5">
          <MfaPanel />
          <SessionsPanel />
          <section className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface p-6 shadow-e1">
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-text-primary">{t("পাসওয়ার্ড", "Password")}</h2>
              <p className="text-meta text-text-muted">{t("নিয়মিত পাসওয়ার্ড পরিবর্তন করুন", "Change it periodically")}</p>
            </div>
            <Button variant="secondary" onClick={() => { window.location.href = "/change-password"; }}>
              {t("পাসওয়ার্ড পরিবর্তন", "Change password")}
            </Button>
          </section>
        </div>
      ) : (
        <PreferencesPanel />
      )}
    </div>
  );
}
