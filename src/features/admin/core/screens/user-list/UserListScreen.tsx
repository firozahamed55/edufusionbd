"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users, ShieldCheck, UserCheck, UserX, KeyRound, UserPlus, Mail, LogOut, History, Send,
} from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import {
  Skeleton, EmptyState, ErrorState, NoAccessState, PageHeader, Pagination, LiveRegion, DataToolbar,
  Badge, Button, buttonClass, Modal, Checkbox, DangerConfirm, useToast, RowActions,
  Field, Input, Table, THead, TBody, TR, TH, TD, TableEmpty, SortableTH,
} from "@/shared/ui";
import { useDataScreen, applyClientList } from "@/shared/lib/useDataScreen";
import { exportCsv } from "@/shared/lib/exportCsv";
import { formatDateTime, localDay } from "@/shared/lib/format";
import { useErrorMessage, classifyError } from "@/shared/services/errors";
import { useZodForm } from "@/shared/lib/useZodForm";
import {
  useUsers, usePermissionMatrix, useSetUserRoles, useSetUserStatus,
  useInviteUser, useSendPasswordReset, useRevokeSessions,
} from "../../logic/hooks";
import { USERS_PAGE_SIZE, type UserRow, type RoleRow } from "../../logic/api";
import { inviteUserSchema } from "../../logic/users";
import { useAdminResetMfa } from "@/shared/services/security/hooks";

/**
 * Core · User & Role Management (SRA F-4 / A-0.4, P0 — settings audit M-15).
 *
 * The database has shipped a complete authorization model since 2026-07-26 and
 * this screen was the reason none of it could be used. Read-only, and — until
 * now — with no way to create the second account, so `profile = 1` in
 * production: a school running on one shared credential with every audit-log
 * entry attributed to it. Four roles, twenty-nine permissions and a permission
 * matrix are worth nothing when there is only ever one person to assign them
 * to. That was the keystone, and it is closed here.
 *
 * WHAT ARRIVED WITH THE INVITE. Suspension turned out to be decorative:
 * `private.has_permission` never looked at `profile.status`, so a suspended
 * account kept every permission it had. And `last_login_at` was never written,
 * so "Last sign-in" was an empty column in every institution. Both are fixed in
 * the database (migration `20260808100000`), which is why they are not visible
 * as changes here — the screen was already showing them; the data was not there.
 *
 * Still deliberately absent: DELETE. Suspension is the operation. A profile
 * carries audit attribution, and deleting one orphans every "who changed this
 * mark" the audit log exists to answer.
 */

const statusTone = (s: string) => (s === "active" ? "success" : s === "suspended" ? "danger" : "warning");

export function UserListScreen() {
  const { t, n } = useT();
  const msg = useErrorMessage();
  const toast = useToast();

  const ds = useDataScreen({ filters: { status: "" }, perPage: USERS_PAGE_SIZE });
  const q = useUsers({ page: ds.page, q: ds.debouncedQ, status: ds.filters.status });
  const matrix = usePermissionMatrix();
  const setStatus = useSetUserStatus();
  const resetPassword = useSendPasswordReset();
  const revoke = useRevokeSessions();

  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [suspending, setSuspending] = useState<UserRow | null>(null);
  const [revoking, setRevoking] = useState<UserRow | null>(null);
  const [resettingMfa, setResettingMfa] = useState<UserRow | null>(null);
  const resetMfa = useAdminResetMfa();

  const all = q.data?.rows ?? [];
  const total = q.data?.total ?? 0;
  const roles = matrix.data?.roles ?? [];
  // The matrix RPC is the reliable signal: it raises 42501 without
  // `core.user_manage`, where the `profile` read just returns nothing.
  const noAccess = matrix.isError && classifyError(matrix.error) === "forbidden";
  // Sorting is client-side over the fetched page. The columns worth sorting —
  // roles and last sign-in — are a joined aggregate and a nullable timestamp;
  // ordering the query by either would page differently than it displays. The
  // label below says so rather than presenting a page-local order as global
  // (audit S-9.4).
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
        onSuccess: () => {
          toast({
            title: status === "suspended"
              ? t("অ্যাকাউন্ট স্থগিত ও সেশন বাতিল", "Account suspended and sessions ended")
              : t("অ্যাকাউন্ট সক্রিয় হয়েছে", "Account reactivated"),
            variant: "success",
          });
          setSuspending(null);
        },
        onError: (e: unknown) => toast({ title: msg(e, { bn: "পরিবর্তন ব্যর্থ", en: "Change failed" }), variant: "error" }),
      },
    );
  }

  function sendReset(user: UserRow) {
    resetPassword.mutate(user.id, {
      onSuccess: () => toast({ title: t("পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে", "Password reset link sent"), variant: "success" }),
      onError: (e: unknown) => toast({ title: msg(e, { bn: "পাঠানো যায়নি", en: "Could not send" }), variant: "error" }),
    });
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
          crumbs={[{ label: t("সেটিংস", "Settings"), href: "/admin/core" }, { label: t("ব্যবহারকারী", "Users") }]}
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
        <EmptyState
          icon={<Users size={22} />}
          title={t("কোনো ব্যবহারকারী নেই", "No users yet")}
          action={<Button variant="primary" onClick={() => setInviting(true)}><UserPlus size={16} /> {t("প্রথম ব্যবহারকারী আমন্ত্রণ", "Invite the first user")}</Button>}
        />
      ) : (
        <>
          <Table minWidth={1040}>
            <THead>
              <TR>
                <SortableTH sortKey="name" sort={ds.sort} onSort={ds.setSort}>{t("নাম", "Name")}</SortableTH>
                <SortableTH sortKey="email" sort={ds.sort} onSort={ds.setSort} className="w-56">{t("ইমেইল", "Email")}</SortableTH>
                <TH className="w-36">{t("ফোন", "Phone")}</TH>
                <SortableTH sortKey="roles" sort={ds.sort} onSort={ds.setSort} className="w-48">{t("ভূমিকা", "Roles")}</SortableTH>
                <SortableTH sortKey="lastLogin" sort={ds.sort} onSort={ds.setSort} className="w-44">{t("সর্বশেষ প্রবেশ", "Last sign-in")}</SortableTH>
                <SortableTH sortKey="status" sort={ds.sort} onSort={ds.setSort} className="w-28 text-center">{t("স্ট্যাটাস", "Status")}</SortableTH>
                <TH className="w-14"><span className="sr-only">{t("অ্যাকশন", "Actions")}</span></TH>
              </TR>
            </THead>
            <TBody>
              {q.isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TR key={i}>{Array.from({ length: 7 }).map((__, j) => <TD key={j}><Skeleton className="h-5" /></TD>)}</TR>
                ))
              ) : rows.length === 0 ? (
                <TableEmpty colSpan={7} icon={<Users size={22} />} title={t("কোনো মিল পাওয়া যায়নি", "No matches")} />
              ) : (
                rows.map((r) => (
                  <TR key={r.id}>
                    <TD className="text-sm font-medium text-text-primary">
                      {r.full_name ?? "—"}
                      {r.roles ? null : (
                        // Audit S-9.8: a user with no role was warned about at
                        // edit time and invisible in the list.
                        <span className="ml-2 align-middle"><Badge tone="warning">{t("ভূমিকা নেই", "No role")}</Badge></span>
                      )}
                    </TD>
                    <TD className="font-latin text-meta text-text-secondary">{r.email ?? "—"}</TD>
                    <TD className="font-latin text-meta text-text-secondary">{r.phone ?? "—"}</TD>
                    <TD className="text-meta text-text-secondary">{r.roles || "—"}</TD>
                    <TD className="text-meta text-text-secondary">
                      {r.lastLoginAt ? formatDateTime(r.lastLoginAt) : t("কখনো নয়", "Never")}
                    </TD>
                    <TD className="text-center"><Badge tone={statusTone(r.status)}>{r.status}</Badge></TD>
                    <TD>
                      <RowActions
                        label={t("অ্যাকশন", "Actions")}
                        actions={[
                          { label: t("ভূমিকা পরিবর্তন", "Change roles"), icon: ShieldCheck, onClick: () => setEditing(r) },
                          // Audit S-9.9: "what has this user done" was
                          // unanswerable from the screen that manages them.
                          {
                            label: t("কার্যক্রম দেখুন", "View activity"),
                            icon: History,
                            href: `/admin/core/audit-log?changedBy=${r.id}`,
                          },
                          r.status === "invited"
                            ? { label: t("আমন্ত্রণ আবার পাঠান", "Resend invite"), icon: Send, onClick: () => sendReset(r) }
                            : { label: t("পাসওয়ার্ড রিসেট পাঠান", "Send password reset"), icon: Mail, onClick: () => sendReset(r) },
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
                `${n(ds.from)}–${n(ds.to(total))} দেখানো হচ্ছে · মোট ${n(total)} জন${ds.sort ? " · সাজানো হয়েছে এই পাতার মধ্যে" : ""}`,
                `Showing ${ds.from}-${ds.to(total)} of ${total}${ds.sort ? " · sorted within this page" : ""}`,
              )}
              pages={ds.pages(total)}
              current={ds.page}
              onPageChange={ds.setPage}
            />
          ) : null}
        </>
      )}

      {inviting ? <InviteDialog roles={roles} loading={matrix.isLoading} onClose={() => setInviting(false)} /> : null}

      {editing ? (
        <RoleEditor
          user={editing}
          roles={roles}
          loading={matrix.isLoading}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {/* Suspension gets the same treatment as an MFA reset (audit S-9.10):
          both end someone's access, and only one of them used to ask why. */}
      {suspending ? (
        <DangerConfirm
          open
          onClose={() => setSuspending(null)}
          title={t("অ্যাকাউন্ট স্থগিত করবেন?", "Suspend this account?")}
          description={t(
            `${suspending.full_name ?? ""} এখনই সাইন আউট হয়ে যাবেন এবং আর প্রবেশ করতে পারবেন না। তাদের রেকর্ড ও অডিট ইতিহাস অক্ষত থাকবে, এবং যেকোনো সময় পুনরায় সক্রিয় করা যাবে।`,
            `${suspending.full_name ?? ""} is signed out immediately and cannot sign in again. Their records and audit history stay intact, and you can reactivate them at any time.`,
          )}
          count={1}
          preview={suspending.full_name ?? suspending.email ?? suspending.phone ?? ""}
          confirmLabel={t("স্থগিত করুন", "Suspend")}
          cancelLabel={t("বাতিল", "Cancel")}
          typeToConfirmLabel={(phrase) => t(`নিশ্চিত করতে ${n(phrase)} টাইপ করুন`, `Type ${phrase} to confirm`)}
          reasonLabel={t("কারণ", "Reason")}
          reasonPlaceholder={t("যেমন: চাকরি ছেড়েছেন, ছুটিতে আছেন", "e.g. left the institution, on long leave")}
          loading={setStatus.isPending}
          onConfirm={(reason) => changeStatus(suspending, "suspended", reason ?? undefined)}
        />
      ) : null}

      {revoking ? (
        <DangerConfirm
          open
          onClose={() => setRevoking(null)}
          title={t("সব সেশন বাতিল করবেন?", "Revoke every session?")}
          description={t(
            `${revoking.full_name ?? ""}-কে সব ডিভাইস থেকে সাইন আউট করা হবে। অ্যাকাউন্ট সক্রিয় থাকবে — তারা আবার সাইন ইন করতে পারবেন।`,
            `${revoking.full_name ?? ""} is signed out on every device. The account stays active — they can sign in again.`,
          )}
          count={1}
          preview={revoking.full_name ?? revoking.email ?? ""}
          confirmLabel={t("বাতিল করুন", "Revoke")}
          cancelLabel={t("ফিরে যান", "Back")}
          typeToConfirmLabel={(phrase) => t(`নিশ্চিত করতে ${n(phrase)} টাইপ করুন`, `Type ${phrase} to confirm`)}
          reasonLabel={t("কারণ", "Reason")}
          reasonPlaceholder={t("যেমন: ডিভাইস হারিয়ে গেছে", "e.g. device lost")}
          loading={revoke.isPending}
          onConfirm={(reason) =>
            revoke.mutate({ profileId: revoking.id, reason: reason ?? undefined }, {
              onSuccess: (count) => {
                toast({ title: t(`${n(String(count))}টি সেশন বাতিল হয়েছে`, `${count} session(s) revoked`), variant: "success" });
                setRevoking(null);
              },
              onError: (e: unknown) => toast({ title: msg(e, { bn: "বাতিল ব্যর্থ", en: "Revoke failed" }), variant: "error" }),
            })
          }
        />
      ) : null}

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
 * The invitation (audit M-15).
 *
 * At least one role is required by the schema, not by politeness: an account
 * with no role signs in, reaches the admin shell, and every query returns
 * nothing — the same "empty screen that reads as a bug" the per-tab permission
 * work exists to remove, arrived at from the other direction.
 */
function InviteDialog({
  roles,
  loading,
  onClose,
}: {
  roles: RoleRow[];
  loading: boolean;
  onClose: () => void;
}) {
  const { t } = useT();
  const msg = useErrorMessage();
  const toast = useToast();
  const invite = useInviteUser();
  const form = useZodForm(inviteUserSchema, { full_name: "", email: "", phone: "", role_ids: [] as string[] });

  const selected = form.values.role_ids;
  const toggle = (id: string) =>
    form.setValue("role_ids", selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  function submit() {
    const parsed = form.submit();
    if (!parsed) return;
    invite.mutate(parsed, {
      onSuccess: () => {
        toast({ title: t("আমন্ত্রণ পাঠানো হয়েছে", "Invitation sent"), variant: "success" });
        onClose();
      },
      onError: (e: unknown) => toast({ title: msg(e, { bn: "আমন্ত্রণ ব্যর্থ", en: "Invitation failed" }), variant: "error" }),
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t("ব্যবহারকারী আমন্ত্রণ", "Invite a user")}
      description={t(
        "তাদের ইমেইলে একটি লিংক যাবে যেখানে তারা নিজের পাসওয়ার্ড ঠিক করবেন।",
        "They receive an email with a link to set their own password.",
      )}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={invite.isPending}>{t("বাতিল", "Cancel")}</Button>
          <Button variant="primary" onClick={submit} disabled={invite.isPending || loading}>
            {invite.isPending ? t("পাঠানো হচ্ছে…", "Sending…") : t("আমন্ত্রণ পাঠান", "Send invitation")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field
          label={t("পুরো নাম", "Full name")}
          required
          error={form.errors.full_name}
          onBlur={() => form.touch("full_name")}
        >
          <Input
            value={form.values.full_name}
            onChange={(e) => form.setValue("full_name", e.target.value)}
            autoFocus
          />
        </Field>
        <Field
          label={t("ইমেইল", "Email")}
          required
          error={form.errors.email}
          onBlur={() => form.touch("email")}
        >
          <Input
            type="email"
            className="font-latin"
            value={form.values.email}
            onChange={(e) => form.setValue("email", e.target.value)}
          />
        </Field>
        <Field
          label={t("মোবাইল নম্বর", "Mobile number")}
          hint={t("ঐচ্ছিক — এসএমএস ও মোবাইল দিয়ে সাইন-ইনের জন্য", "Optional — used for SMS and mobile sign-in")}
          error={form.errors.phone}
          onBlur={() => form.touch("phone")}
        >
          <Input
            className="font-latin"
            inputMode="numeric"
            value={form.values.phone}
            onChange={(e) => form.setValue("phone", e.target.value)}
          />
        </Field>

        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-meta font-medium text-text-secondary">
            {t("ভূমিকা", "Roles")} <span className="text-danger-fg">*</span>
          </legend>
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)
          ) : (
            roles.map((r) => (
              <label key={r.id} className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2.5 hover:bg-sunken">
                <Checkbox className="mt-0.5" checked={selected.includes(r.id)} onChange={() => toggle(r.id)} />
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-medium text-text-primary">{r.name}</span>
                  {r.description ? <span className="text-micro text-text-muted">{r.description}</span> : null}
                </span>
              </label>
            ))
          )}
          {form.errors.role_ids ? (
            <span role="alert" className="text-xs font-medium text-danger-fg">{form.errors.role_ids}</span>
          ) : null}
        </fieldset>
      </div>
    </Modal>
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
  roles: RoleRow[];
  loading: boolean;
  onClose: () => void;
}) {
  const { t, n } = useT();
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
            <label key={r.id} className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2.5 hover:bg-sunken">
              <Checkbox className="mt-0.5" checked={selected.includes(r.id)} onChange={() => toggle(r.id)} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-medium text-text-primary">{r.name}</span>
                {/* Audit S-9.7: the dialog listed `name` + `code` and left the
                    operator to guess what ticking the box grants. */}
                {r.description ? <span className="text-micro text-text-muted">{r.description}</span> : null}
              </span>
              <span className="shrink-0 text-micro text-text-muted">
                {t(`${n(String(r.user_count))} জন`, `${r.user_count} held`)}
              </span>
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
      <Link
        href="/admin/core/permissions"
        className="mt-3 inline-flex items-center gap-1.5 text-meta font-medium text-primary hover:underline"
      >
        <ShieldCheck size={14} /> {t("প্রতিটি ভূমিকা কী করতে পারে দেখুন", "See what each role can do")}
      </Link>
    </Modal>
  );
}
