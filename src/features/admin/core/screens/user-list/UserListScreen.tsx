"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, ShieldCheck, UserCheck, UserX, KeyRound, UserPlus, Mail, LogOut, Send, History } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import {
  Skeleton, EmptyState, ErrorState, NoAccessState, PageHeader, Pagination, LiveRegion, DataToolbar,
  Badge, Button, buttonClass, Modal, Checkbox, ConfirmDialog, DangerConfirm, useToast, RowActions,
  Field, Input, Textarea,
  Table, THead, TBody, TR, TH, TD, TableEmpty, SortableTH,
} from "@/shared/ui";
import { useDataScreen, applyClientList } from "@/shared/lib/useDataScreen";
import { useZodForm } from "@/shared/lib/useZodForm";
import { exportCsv } from "@/shared/lib/exportCsv";
import { formatDateTime, localDay } from "@/shared/lib/format";
import { useErrorMessage, classifyError } from "@/shared/services/errors";
import {
  useUsers, usePermissionMatrix, useSetUserRoles, useSetUserStatus,
  useInviteUser, useSendPasswordReset, useRevokeSessions,
} from "../../logic/hooks";
import { inviteUserSchema } from "../../logic/userOps";
import { USERS_PAGE_SIZE, type UserRow } from "../../logic/api";
import { useAdminResetMfa } from "@/shared/services/security/hooks";

/**
 * Core · User & Role Management (SRA F-4 / A-0.4, P0).
 *
 * The database has shipped a complete authorization model since 2026-07-26 and
 * this screen was the reason none of it could be used: name, phone, roles,
 * status and a CSV export, read-only. So a school ran on one shared credential
 * and every audit-log entry attributed to the same account.
 *
 * Now: invite, assign roles, suspend and reactivate, send a password reset,
 * revoke live sessions, see last sign-in and email, and the full
 * data-interaction contract on top.
 *
 * INVITE ARRIVED (Settings audit M-15). The comment that used to sit here said
 * invite was deferred because creating an auth user needs the service-role key.
 * That was true and it was the keystone: with `profile = 1` in production, four
 * roles and twenty-nine permissions had nobody to be assigned to, so the entire
 * access-control investment was blocked on one server route. It is
 * `/api/admin/users/invite`, and the two operations that came with it —
 * password reset and session revoke — turned out to need no privileged key at
 * all, only a guard, a rate limit and an audit row.
 *
 * Still deliberately NOT here: delete. Suspension is the operation; a profile
 * carries audit attribution, and deleting one orphans every "who changed this
 * mark" the audit log exists to answer.
 */

const statusTone = (s: string) => (s === "active" ? "success" : s === "suspended" ? "danger" : "warning");

/**
 * The badge used to print the raw column value, so a Bangla-locale operator
 * read "suspended" in Latin script in an otherwise Bangla table.
 */
const statusLabel = (s: string, t: (bn: string, en: string) => string) =>
  s === "active" ? t("সক্রিয়", "Active")
    : s === "suspended" ? t("স্থগিত", "Suspended")
      : s === "invited" ? t("আমন্ত্রিত", "Invited")
        : s;

export function UserListScreen() {
  const { t, n } = useT();
  const msg = useErrorMessage();
  const toast = useToast();

  const ds = useDataScreen({ filters: { status: "" }, perPage: USERS_PAGE_SIZE });
  const q = useUsers({ page: ds.page, q: ds.debouncedQ, status: ds.filters.status });
  const matrix = usePermissionMatrix();
  const setStatus = useSetUserStatus();

  const [editing, setEditing] = useState<UserRow | null>(null);
  const [suspending, setSuspending] = useState<UserRow | null>(null);
  const [resettingMfa, setResettingMfa] = useState<UserRow | null>(null);
  const [inviting, setInviting] = useState(false);
  const [revoking, setRevoking] = useState<UserRow | null>(null);
  const resetMfa = useAdminResetMfa();
  const resend = useInviteUser();
  const sendReset = useSendPasswordReset();
  const revoke = useRevokeSessions();

  const all = q.data?.rows ?? [];
  const total = q.data?.total ?? 0;
  // The matrix RPC is the reliable signal: it raises 42501 without
  // `core.user_manage`, where the `profile` read just returns nothing.
  const noAccess = matrix.isError && classifyError(matrix.error) === "forbidden";
  // Sorting is client-side over the fetched page. The columns worth sorting —
  // roles and last sign-in — are a joined aggregate and a nullable timestamp;
  // ordering the query by either would page differently than it displays.
  const { rows } = applyClientList(all, { ...ds, page: 1, perPage: all.length || 1 }, {
    sort: {
      name: (r) => r.full_name,
      email: (r) => r.email,
      roles: (r) => r.roles,
      status: (r) => r.status,
      lastLogin: (r) => r.lastLoginAt,
    },
  });

  function changeStatus(user: UserRow, status: "active" | "suspended", reason?: string) {
    setStatus.mutate(
      { profileId: user.id, status, reason },
      {
        onSuccess: () =>
          toast({
            title: status === "suspended"
              ? t("অ্যাকাউন্ট স্থগিত হয়েছে", "Account suspended")
              : t("অ্যাকাউন্ট সক্রিয় হয়েছে", "Account reactivated"),
            variant: "success",
          }),
        onError: (e: unknown) => toast({ title: msg(e, { bn: "পরিবর্তন ব্যর্থ", en: "Change failed" }), variant: "error" }),
      },
    );
    setSuspending(null);
  }

  function onPasswordReset(user: UserRow) {
    sendReset.mutate(user.id, {
      onSuccess: () => toast({ title: t("রিসেট লিংক পাঠানো হয়েছে", "Reset link sent"), variant: "success" }),
      onError: (e: unknown) => toast({ title: msg(e, { bn: "পাঠানো যায়নি", en: "Could not send" }), variant: "error" }),
    });
  }

  function onRevokeSessions(user: UserRow) {
    revoke.mutate(user.id, {
      onSuccess: (data) => {
        toast({
          title: t(`${n(data.revoked)}টি সেশন বাতিল হয়েছে`, `${data.revoked} session(s) revoked`),
          variant: "success",
        });
        setRevoking(null);
      },
      onError: (e: unknown) => toast({ title: msg(e, { bn: "বাতিল করা যায়নি", en: "Could not revoke" }), variant: "error" }),
    });
  }

  function resendInvite(user: UserRow) {
    if (!user.email) {
      toast({ title: t("এই অ্যাকাউন্টে কোনো ইমেইল নেই", "That account has no email on file"), variant: "error" });
      return;
    }
    resend.mutate(
      { email: user.email, full_name: user.full_name ?? user.email, phone: undefined, role_ids: user.roleIds, message: undefined },
      {
        onSuccess: () => toast({ title: t("আমন্ত্রণ আবার পাঠানো হয়েছে", "Invitation resent"), variant: "success" }),
        onError: (e: unknown) => toast({ title: msg(e, { bn: "পাঠানো যায়নি", en: "Could not resend" }), variant: "error" }),
      },
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <LiveRegion
        message={
          q.isLoading
            ? t("লোড হচ্ছে", "Loading users")
            : t(`${n(total)} জন ব্যবহারকারী পাওয়া গেছে`, `${total} users found`)
        }
      />

      <div className="flex flex-wrap items-start gap-3">
        <PageHeader
          className="flex-1"
          crumbs={[{ label: t("কোর সেটিংস", "Core Settings"), href: "/admin/core/basic-config" }, { label: t("ব্যবহারকারী", "Users") }]}
          title={t("ব্যবহারকারী ও ভূমিকা", "Users & Roles")}
          subtitle={t("প্রতিষ্ঠানের ব্যবহারকারী, তাদের ভূমিকা ও অ্যাক্সেস", "Institution users, their roles and access")}
        />
        <Link href="/admin/core/permissions" className={buttonClass("secondary")}>
          <ShieldCheck size={16} /> {t("অনুমতি ম্যাট্রিক্স", "Permission matrix")}
        </Link>
        <Button variant="primary" onClick={() => setInviting(true)}>
          <UserPlus size={16} /> {t("ব্যবহারকারী আমন্ত্রণ", "Invite user")}
        </Button>
      </div>

      <DataToolbar
        q={ds.q}
        onQChange={ds.setQ}
        placeholder={t("নাম, ফোন বা ইমেইল খুঁজুন", "Search name, phone or email")}
        searchLabel={t("ব্যবহারকারী খুঁজুন", "Search users")}
        isFiltered={ds.isFiltered}
        onReset={ds.reset}
        filters={
          <select
            value={ds.filters.status}
            onChange={(e) => ds.setFilter("status", e.target.value)}
            aria-label={t("স্ট্যাটাস ফিল্টার", "Filter by status")}
            className="rounded-lg border border-border-strong bg-surface px-3 py-2.5 text-meta font-medium text-text-secondary"
          >
            <option value="">{t("সব স্ট্যাটাস", "All statuses")}</option>
            <option value="active">{t("সক্রিয়", "Active")}</option>
            <option value="suspended">{t("স্থগিত", "Suspended")}</option>
            <option value="invited">{t("আমন্ত্রিত", "Invited")}</option>
          </select>
        }
        onExportPage={() =>
          exportCsv(
            `users-${localDay()}.csv`,
            rows.map((r) => ({
              Name: r.full_name ?? "",
              Email: r.email ?? "",
              Phone: r.phone ?? "",
              Roles: r.roles,
              Status: r.status,
              LastSignIn: r.lastLoginAt ?? "",
            })),
            { kind: "core.user_list", params: { q: ds.debouncedQ, status: ds.filters.status, page: ds.page, scope: "page" } },
          )
        }
        exportPageCount={rows.length}
      />

      {/* Audit M-4. Without `core.user_manage`, RLS returns zero rows and the
          screen used to render "No users yet" — a correct system that looks
          broken, and gets reported as a bug rather than as an access decision.
          `noAccess` is derived from the matrix query rather than from the row
          count, because zero rows is genuinely ambiguous and 42501 is not. */}
      {noAccess ? (
        <NoAccessState
          title={t("এই পাতা দেখার অনুমতি নেই", "You do not have access to this page")}
          description={t(
            "ব্যবহারকারী ও ভূমিকা দেখতে ও পরিবর্তন করতে ব্যবহারকারী ব্যবস্থাপনার অনুমতি প্রয়োজন।",
            "Viewing and changing users and roles needs user-management access.",
          )}
          permission="core.user_manage"
        />
      ) : q.isError ? (
        <ErrorState title={t("ব্যবহারকারী লোড করা যায়নি", "Could not load users")} description={msg(q.error)} />
      ) : !q.isLoading && total === 0 && !ds.isFiltered ? (
        <EmptyState icon={<Users size={22} />} title={t("কোনো ব্যবহারকারী নেই", "No users yet")} />
      ) : (
        <>
          <Table minWidth={1060}>
            <THead>
              <TR>
                <SortableTH sortKey="name" sort={ds.sort} onSort={ds.setSort}>{t("নাম", "Name")}</SortableTH>
                {/* S-9.3 — identity was name + phone, which does not separate
                    two Rahmans and is not the address any of these actions
                    write to. */}
                <SortableTH sortKey="email" sort={ds.sort} onSort={ds.setSort} className="w-56">{t("ইমেইল", "Email")}</SortableTH>
                <TH className="w-40">{t("ফোন", "Phone")}</TH>
                <SortableTH sortKey="roles" sort={ds.sort} onSort={ds.setSort} className="w-56">{t("ভূমিকা", "Roles")}</SortableTH>
                <SortableTH sortKey="lastLogin" sort={ds.sort} onSort={ds.setSort} className="w-48">{t("সর্বশেষ প্রবেশ", "Last sign-in")}</SortableTH>
                <SortableTH sortKey="status" sort={ds.sort} onSort={ds.setSort} className="w-28 text-center">{t("স্ট্যাটাস", "Status")}</SortableTH>
                <TH className="w-14"><span className="sr-only">{t("অ্যাকশন", "Actions")}</span></TH>
              </TR>
            </THead>
            <TBody>
              {q.isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TR key={i}>{Array.from({ length: 6 }).map((__, j) => <TD key={j}><Skeleton className="h-5" /></TD>)}</TR>
                ))
              ) : rows.length === 0 ? (
                <TableEmpty colSpan={7} icon={<Users size={22} />} title={t("কোনো মিল পাওয়া যায়নি", "No matches")} />
              ) : (
                rows.map((r) => (
                  <TR key={r.id}>
                    <TD className="text-sm font-medium text-text-primary">{r.full_name ?? "—"}</TD>
                    <TD className="font-latin text-meta text-text-secondary">{r.email ?? "—"}</TD>
                    <TD className="font-latin text-meta text-text-secondary">{r.phone ?? "—"}</TD>
                    <TD className="text-meta text-text-secondary">{r.roles || t("কোনো ভূমিকা নেই", "No role")}</TD>
                    <TD className="text-meta text-text-secondary">
                      {r.lastLoginAt
                        ? formatDateTime(r.lastLoginAt)
                        : r.status === "invited" && r.invitedAt
                          ? t(`আমন্ত্রিত ${formatDateTime(r.invitedAt)}`, `Invited ${formatDateTime(r.invitedAt)}`)
                          : t("কখনো নয়", "Never")}
                    </TD>
                    <TD className="text-center">
                      <Badge tone={statusTone(r.status)}>{statusLabel(r.status, t)}</Badge>
                      {r.status === "suspended" && r.suspendedReason ? (
                        <span className="mt-1 block text-micro text-text-muted">{r.suspendedReason}</span>
                      ) : null}
                    </TD>
                    <TD>
                      <RowActions
                        label={t("অ্যাকশন", "Actions")}
                        actions={[
                          { label: t("ভূমিকা পরিবর্তন", "Change roles"), icon: ShieldCheck, onClick: () => setEditing(r) },
                          // S-9.6 — `invited` was offered as a filter value that
                          // no code path could ever produce. Now it is a state
                          // with an action attached to it.
                          ...(r.status === "invited"
                            ? [{ label: t("আমন্ত্রণ আবার পাঠান", "Resend invite"), icon: Send, onClick: () => resendInvite(r) }]
                            : []),
                          // S-9.9 — "what has this user done" was unanswerable
                          // from the screen that manages them, because the
                          // audit log had no actor filter. It has one now, and
                          // this is the link into it.
                          { label: t("কার্যকলাপ দেখুন", "View activity"), icon: History, href: `/admin/core/audit-log?changedBy=${r.id}` },
                          { label: t("পাসওয়ার্ড রিসেট পাঠান", "Send password reset"), icon: Mail, onClick: () => onPasswordReset(r) },
                          { label: t("সব সেশন বাতিল", "Revoke sessions"), icon: LogOut, tone: "danger" as const, onClick: () => setRevoking(r) },
                          r.status === "suspended"
                            ? { label: t("পুনরায় সক্রিয়", "Reactivate"), icon: UserCheck, onClick: () => changeStatus(r, "active") }
                            : { label: t("স্থগিত করুন", "Suspend"), icon: UserX, tone: "danger" as const, onClick: () => setSuspending(r) },
                          // SRA B-2, last bullet. The realistic failure: a head
                          // teacher's phone is lost or wiped AND the recovery
                          // codes are gone. Without this the institution's only
                          // administrator is locked out of its own product.
                          { label: t("দুই-ধাপ যাচাইকরণ রিসেট", "Reset two-step verification"), icon: KeyRound, tone: "danger" as const, onClick: () => setResettingMfa(r) },
                        ]}
                      />
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>

          {total > ds.perPage ? (
            <Pagination
              label={t(
                `${n(ds.from)}–${n(ds.to(total))} দেখানো হচ্ছে · মোট ${n(total)} জন`,
                `Showing ${ds.from}-${ds.to(total)} of ${total}`,
              )}
              pages={ds.pages(total)}
              current={ds.page}
              onPageChange={ds.setPage}
            />
          ) : null}
        </>
      )}

      {inviting ? <InviteDialog roles={matrix.data?.roles ?? []} onClose={() => setInviting(false)} /> : null}

      {editing ? (
        <RoleEditor
          user={editing}
          roles={matrix.data?.roles ?? []}
          loading={matrix.isLoading}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {suspending ? (
        <SuspendDialog
          user={suspending}
          loading={setStatus.isPending}
          onClose={() => setSuspending(null)}
          onConfirm={(reason) => changeStatus(suspending, "suspended", reason)}
        />
      ) : null}

      {/* Not a `DangerConfirm`: this is reversible in the only sense that
          matters — the person signs in again. Type-to-confirm belongs on
          actions that destroy something, and spending it here would blunt it
          where it is actually needed. */}
      <ConfirmDialog
        open={revoking !== null}
        onClose={() => setRevoking(null)}
        onConfirm={() => { if (revoking) onRevokeSessions(revoking); }}
        tone="danger"
        title={t("সব সেশন বাতিল করবেন?", "Revoke every session?")}
        description={t(
          `${revoking?.full_name ?? ""} প্রতিটি ডিভাইস থেকে সাইন আউট হয়ে যাবেন এবং আবার লগ ইন করতে হবে। ইতিমধ্যে ইস্যু করা অ্যাক্সেস টোকেন মেয়াদ শেষ না হওয়া পর্যন্ত (সর্বোচ্চ এক ঘণ্টা) কাজ করতে পারে — এটি Supabase Auth-এর আচরণ।`,
          `${revoking?.full_name ?? ""} is signed out on every device and must log in again. An access token already issued can keep working until it expires — up to an hour — which is Supabase Auth's behaviour, not an oversight here.`,
        )}
        confirmLabel={t("বাতিল করুন", "Revoke")}
        cancelLabel={t("থাক", "Cancel")}
        loading={revoke.isPending}
      />

      {resettingMfa ? (
        <DangerConfirm
          open
          onClose={() => setResettingMfa(null)}
          title={t("দুই-ধাপ যাচাইকরণ রিসেট করবেন?", "Reset two-step verification?")}
          description={t(
            `${resettingMfa.full_name ?? ""}-এর অথেন্টিকেটর ও সব রিকভারি কোড মুছে যাবে, এবং তারা শুধু পাসওয়ার্ড দিয়েই ঢুকতে পারবেন যতক্ষণ না নতুন করে সেটআপ করছেন। এটি একটি উচ্চ-ঝুঁকির কাজ এবং অডিট লগে লেখা হবে।`,
            `${resettingMfa.full_name ?? ""}'s authenticator and every recovery code are removed, and they will sign in with a password alone until they enrol again. This is a high-severity action and is written to the audit log.`,
          )}
          count={1}
          preview={resettingMfa.full_name ?? resettingMfa.phone ?? ""}
          confirmLabel={t("রিসেট করুন", "Reset MFA")}
          cancelLabel={t("বাতিল", "Cancel")}
          typeToConfirmLabel={(phrase) => t(`নিশ্চিত করতে ${n(phrase)} টাইপ করুন`, `Type ${phrase} to confirm`)}
          reasonLabel={t("কারণ", "Reason")}
          reasonPlaceholder={t("যেমন: ফোন হারিয়ে গেছে, ব্যক্তিগতভাবে যাচাই করা হয়েছে", "e.g. phone lost, identity confirmed in person")}
          loading={resetMfa.isPending}
          onConfirm={(reason) => {
            resetMfa.mutate({ profileId: resettingMfa.id, reason: reason ?? "" }, {
              onSuccess: () => { toast({ title: t("রিসেট হয়েছে", "MFA reset"), variant: "success" }); setResettingMfa(null); },
              onError: (e: unknown) => toast({ title: msg(e, { bn: "রিসেট ব্যর্থ", en: "Reset failed" }), variant: "error" }),
            });
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * Set semantics: the dialog sends the complete intended list, so unticking a
 * role revokes it. The RPC refuses to let an operator strip their own last
 * admin role — the check lives there, not here, because a disabled checkbox in
 * one browser is not an authorization control.
 */
function RoleEditor({
  user,
  roles,
  loading,
  onClose,
}: {
  user: UserRow;
  roles: { id: string; code: string; name: string }[];
  loading: boolean;
  onClose: () => void;
}) {
  const { t } = useT();
  const msg = useErrorMessage();
  const toast = useToast();
  const save = useSetUserRoles();
  const [selected, setSelected] = useState<string[]>(user.roleIds);
  useEffect(() => setSelected(user.roleIds), [user.roleIds]);

  const toggle = (id: string) =>
    setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  function submit() {
    save.mutate(
      { profileId: user.id, roleIds: selected },
      {
        onSuccess: () => { toast({ title: t("ভূমিকা হালনাগাদ হয়েছে", "Roles updated"), variant: "success" }); onClose(); },
        onError: (e: unknown) => toast({ title: msg(e, { bn: "পরিবর্তন ব্যর্থ", en: "Update failed" }), variant: "error" }),
      },
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t("ভূমিকা নির্ধারণ", "Assign roles")}
      description={user.full_name ?? undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>{t("বাতিল", "Cancel")}</Button>
          <Button variant="primary" onClick={submit} disabled={save.isPending || loading}>
            {save.isPending ? t("সংরক্ষণ হচ্ছে…", "Saving…") : t("সংরক্ষণ করুন", "Save")}
          </Button>
        </>
      }
    >
      {loading ? (
        <div className="flex flex-col gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
      ) : (
        <fieldset className="flex flex-col gap-1">
          <legend className="sr-only">{t("ভূমিকাসমূহ", "Roles")}</legend>
          {roles.map((r) => (
            <label key={r.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-sunken">
              <Checkbox checked={selected.includes(r.id)} onChange={() => toggle(r.id)} />
              <span className="text-sm font-medium text-text-primary">{r.name}</span>
              <span className="font-latin text-xs text-text-muted">{r.code}</span>
            </label>
          ))}
          {selected.length === 0 ? (
            <p role="status" className="mt-2 rounded-lg bg-warning-bg px-3 py-2 text-meta text-warning-fg">
              {t(
                "কোনো ভূমিকা নেই মানে এই ব্যবহারকারী সাইন ইন করতে পারবেন কিন্তু কিছুই দেখতে পাবেন না।",
                "With no role, this user can sign in but will see nothing.",
              )}
            </p>
          ) : null}
        </fieldset>
      )}
    </Modal>
  );
}

/**
 * Suspension with a reason (audit S-9.10).
 *
 * MFA reset has required a reason since it shipped and suspension — an action
 * of comparable consequence to the person on the receiving end — recorded
 * nothing at all, so "why is this account off" was unanswerable a month later.
 * Optional rather than mandatory: an administrator suspending a departing
 * colleague at 4pm on a Thursday should not be blocked by a text box, and a
 * mandatory field that people type "x" into records less than an empty one.
 */
function SuspendDialog({
  user,
  loading,
  onClose,
  onConfirm,
}: {
  user: UserRow;
  loading: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const { t } = useT();
  const [reason, setReason] = useState("");

  return (
    <Modal
      open
      onClose={onClose}
      title={t("অ্যাকাউন্ট স্থগিত করবেন?", "Suspend this account?")}
      description={t(
        `${user.full_name ?? ""} আর সাইন ইন করতে পারবেন না এবং তাদের চালু সেশনগুলো এখনই বন্ধ হয়ে যাবে। রেকর্ড ও অডিট ইতিহাস অক্ষত থাকবে, যেকোনো সময় পুনরায় সক্রিয় করা যাবে।`,
        `${user.full_name ?? ""} will no longer be able to sign in, and their live sessions end now. Records and audit history stay intact, and you can reactivate them at any time.`,
      )}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>{t("বাতিল", "Cancel")}</Button>
          <Button variant="danger" onClick={() => onConfirm(reason.trim())} disabled={loading}>
            {loading ? t("স্থগিত হচ্ছে…", "Suspending…") : t("স্থগিত করুন", "Suspend")}
          </Button>
        </>
      }
    >
      <Field
        label={t("কারণ (ঐচ্ছিক)", "Reason (optional)")}
        hint={t("তালিকায় দেখানো হবে এবং অডিট লগে থাকবে।", "Shown in the list and kept in the audit log.")}
      >
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={200}
          placeholder={t("যেমন: চাকরি ছেড়েছেন, তদন্ত চলছে", "e.g. left the school, under investigation")}
        />
      </Field>
    </Modal>
  );
}

/**
 * The invite dialog (audit M-15, S-9.1).
 *
 * Validated with the SAME zod schema the route parses the request body with,
 * so the form cannot ask for something the server will refuse on shape. What
 * the server still decides alone, because only it can: the rate limit, whether
 * the address already belongs to an active account, and whether the caller
 * holds `core.user_manage`. Those come back as field-less errors and land in a
 * toast, which is right — none of them is a property of a field.
 *
 * Roles are optional. "Let them in now, decide what they do tomorrow" is a real
 * workflow in a school office, and the dialog says what a role-less account
 * means rather than blocking it.
 */
function InviteDialog({
  roles,
  onClose,
}: {
  roles: { id: string; code: string; name: string }[];
  onClose: () => void;
}) {
  const { t } = useT();
  const msg = useErrorMessage();
  const toast = useToast();
  const invite = useInviteUser();

  const form = useZodForm(inviteUserSchema, {
    email: "",
    full_name: "",
    phone: "",
    role_ids: [] as string[],
    message: "",
  });

  const toggleRole = (id: string) =>
    form.setValue(
      "role_ids",
      form.values.role_ids.includes(id)
        ? form.values.role_ids.filter((x) => x !== id)
        : [...form.values.role_ids, id],
    );

  function submit() {
    const parsed = form.submit();
    if (!parsed) {
      // A-4 — a toast that names no field leaves a keyboard user with nowhere
      // to go. The first invalid input gets focus.
      const first = (["email", "full_name", "phone"] as const).find((k) => form.errors[k]);
      if (first) document.getElementById(`invite-${first}`)?.focus();
      return;
    }
    invite.mutate(parsed, {
      onSuccess: () => {
        toast({ title: t("আমন্ত্রণ পাঠানো হয়েছে", "Invitation sent"), variant: "success" });
        onClose();
      },
      onError: (e: unknown) => toast({ title: msg(e, { bn: "আমন্ত্রণ পাঠানো যায়নি", en: "Could not send the invitation" }), variant: "error" }),
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t("ব্যবহারকারী আমন্ত্রণ", "Invite a user")}
      description={t(
        "তারা একটি ইমেইল পাবেন যেখান থেকে নিজের পাসওয়ার্ড ঠিক করে প্রথমবার সাইন ইন করবেন।",
        "They receive an email that lets them set their own password and sign in for the first time.",
      )}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={invite.isPending}>{t("বাতিল", "Cancel")}</Button>
          <Button variant="primary" onClick={submit} disabled={invite.isPending}>
            {invite.isPending ? t("পাঠানো হচ্ছে…", "Sending…") : t("আমন্ত্রণ পাঠান", "Send invitation")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label={t("পূর্ণ নাম", "Full name")} required error={form.errors.full_name} onBlur={() => form.touch("full_name")}>
          <Input
            id="invite-full_name"
            value={form.values.full_name}
            onChange={(e) => form.setValue("full_name", e.target.value)}
            autoComplete="off"
          />
        </Field>

        <Field label={t("ইমেইল", "Email")} required error={form.errors.email} onBlur={() => form.touch("email")}>
          <Input
            id="invite-email"
            type="email"
            value={form.values.email}
            onChange={(e) => form.setValue("email", e.target.value)}
            className="font-latin"
            autoComplete="off"
          />
        </Field>

        <Field
          label={t("মোবাইল (ঐচ্ছিক)", "Mobile (optional)")}
          error={form.errors.phone}
          onBlur={() => form.touch("phone")}
        >
          <Input
            id="invite-phone"
            inputMode="numeric"
            value={form.values.phone}
            onChange={(e) => form.setValue("phone", e.target.value)}
            placeholder="01XXXXXXXXX"
            className="font-latin"
          />
        </Field>

        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-meta font-medium text-text-secondary">{t("ভূমিকা", "Roles")}</legend>
          {roles.map((r) => (
            <label key={r.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-sunken">
              <Checkbox checked={form.values.role_ids.includes(r.id)} onChange={() => toggleRole(r.id)} />
              <span className="text-sm font-medium text-text-primary">{r.name}</span>
              <span className="font-latin text-xs text-text-muted">{r.code}</span>
            </label>
          ))}
          {form.values.role_ids.length === 0 ? (
            <p role="status" className="mt-1 rounded-lg bg-warning-bg px-3 py-2 text-meta text-warning-fg">
              {t(
                "কোনো ভূমিকা ছাড়া তারা সাইন ইন করতে পারবেন কিন্তু কিছুই দেখতে পাবেন না। পরে যেকোনো সময় দেওয়া যাবে।",
                "With no role they can sign in but will see nothing. You can assign one at any time afterwards.",
              )}
            </p>
          ) : null}
        </fieldset>

        <Field
          label={t("স্বাগত বার্তা (ঐচ্ছিক)", "Welcome message (optional)")}
          error={form.errors.message}
          hint={t("আমন্ত্রণ ইমেইলে যুক্ত হবে।", "Included in the invitation email.")}
        >
          <Textarea
            value={String(form.values.message ?? "")}
            onChange={(e) => form.setValue("message", e.target.value)}
            maxLength={500}
          />
        </Field>
      </div>
    </Modal>
  );
}
