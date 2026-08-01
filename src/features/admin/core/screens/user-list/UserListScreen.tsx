"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, ShieldCheck, UserCheck, UserX, KeyRound, Info } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import {
  Skeleton, EmptyState, ErrorState, PageHeader, Pagination, LiveRegion, DataToolbar,
  Badge, Button, buttonClass, Modal, Checkbox, ConfirmDialog, DangerConfirm, useToast, RowActions,
  Table, THead, TBody, TR, TH, TD, TableEmpty, SortableTH,
} from "@/shared/ui";
import { useDataScreen, applyClientList } from "@/shared/lib/useDataScreen";
import { exportCsv } from "@/shared/lib/exportCsv";
import { formatDateTime, localDay } from "@/shared/lib/format";
import { useErrorMessage } from "@/shared/services/errors";
import {
  useUsers, usePermissionMatrix, useSetUserRoles, useSetUserStatus,
} from "../../logic/hooks";
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
 * Now: assign roles, suspend and reactivate, see last sign-in, and the full
 * data-interaction contract on top.
 *
 * Two things this deliberately does NOT do.
 *
 * - No invite. Creating an auth user needs the Supabase **service role** key,
 *   which cannot exist in a browser bundle. That is a server route with its own
 *   rate limit and audit trail, and it is Phase 3's work with the rest of auth.
 *   Until then the screen says so rather than implying otherwise.
 * - No delete. Suspension is the operation; a profile carries audit
 *   attribution, and deleting one orphans every "who changed this mark" the
 *   audit log exists to answer.
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

  const [editing, setEditing] = useState<UserRow | null>(null);
  const [suspending, setSuspending] = useState<UserRow | null>(null);
  const [resettingMfa, setResettingMfa] = useState<UserRow | null>(null);
  const resetMfa = useAdminResetMfa();

  const all = q.data?.rows ?? [];
  const total = q.data?.total ?? 0;
  // Sorting is client-side over the fetched page. The columns worth sorting —
  // roles and last sign-in — are a joined aggregate and a nullable timestamp;
  // ordering the query by either would page differently than it displays.
  const { rows } = applyClientList(all, { ...ds, page: 1, perPage: all.length || 1 }, {
    sort: {
      name: (r) => r.full_name,
      roles: (r) => r.roles,
      status: (r) => r.status,
      lastLogin: (r) => r.lastLoginAt,
    },
  });

  function changeStatus(user: UserRow, status: "active" | "suspended") {
    setStatus.mutate(
      { profileId: user.id, status },
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
      </div>

      <DataToolbar
        q={ds.q}
        onQChange={ds.setQ}
        placeholder={t("নাম বা ফোন খুঁজুন", "Search name or phone")}
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
              Phone: r.phone ?? "",
              Roles: r.roles,
              Status: r.status,
              LastSignIn: r.lastLoginAt ?? "",
            })),
            { kind: "core.user_list" },
          )
        }
        exportPageCount={rows.length}
      />

      {q.isError ? (
        <ErrorState title={t("ব্যবহারকারী লোড করা যায়নি", "Could not load users")} description={msg(q.error)} />
      ) : !q.isLoading && total === 0 && !ds.isFiltered ? (
        <EmptyState icon={<Users size={22} />} title={t("কোনো ব্যবহারকারী নেই", "No users yet")} />
      ) : (
        <>
          <Table minWidth={880}>
            <THead>
              <TR>
                <SortableTH sortKey="name" sort={ds.sort} onSort={ds.setSort}>{t("নাম", "Name")}</SortableTH>
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
                <TableEmpty colSpan={6} icon={<Users size={22} />} title={t("কোনো মিল পাওয়া যায়নি", "No matches")} />
              ) : (
                rows.map((r) => (
                  <TR key={r.id}>
                    <TD className="text-sm font-medium text-text-primary">{r.full_name ?? "—"}</TD>
                    <TD className="font-latin text-meta text-text-secondary">{r.phone ?? "—"}</TD>
                    <TD className="text-meta text-text-secondary">{r.roles || t("কোনো ভূমিকা নেই", "No role")}</TD>
                    <TD className="text-meta text-text-secondary">
                      {r.lastLoginAt ? formatDateTime(r.lastLoginAt) : t("কখনো নয়", "Never")}
                    </TD>
                    <TD className="text-center"><Badge tone={statusTone(r.status)}>{r.status}</Badge></TD>
                    <TD>
                      <RowActions
                        label={t("অ্যাকশন", "Actions")}
                        actions={[
                          { label: t("ভূমিকা পরিবর্তন", "Change roles"), icon: ShieldCheck, onClick: () => setEditing(r) },
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

      <p className="flex items-start gap-2 rounded-lg border border-border-default bg-sunken px-4 py-3 text-meta text-text-secondary">
        <Info size={15} className="mt-0.5 shrink-0" />
        {t(
          "নতুন ব্যবহারকারী আমন্ত্রণ Supabase Auth-এর সার্ভিস কী দিয়ে সার্ভার থেকে করতে হয় — এটি Phase 3-এর অথ কাজের সাথে আসছে। এখানে বিদ্যমান ব্যবহারকারীর ভূমিকা ও অ্যাক্সেস পরিবর্তন করা যায়।",
          "Inviting a new user needs Supabase Auth's service key from a server route — that arrives with the Phase 3 auth work. This screen changes the roles and access of users who already exist.",
        )}
      </p>

      {editing ? (
        <RoleEditor
          user={editing}
          roles={matrix.data?.roles ?? []}
          loading={matrix.isLoading}
          onClose={() => setEditing(null)}
        />
      ) : null}

      <ConfirmDialog
        open={suspending !== null}
        onClose={() => setSuspending(null)}
        onConfirm={() => suspending && changeStatus(suspending, "suspended")}
        tone="danger"
        title={t("অ্যাকাউন্ট স্থগিত করবেন?", "Suspend this account?")}
        description={t(
          `${suspending?.full_name ?? ""} আর সাইন ইন করতে পারবেন না। তাদের পুরনো রেকর্ড ও অডিট ইতিহাস অক্ষত থাকবে, এবং যেকোনো সময় পুনরায় সক্রিয় করা যাবে।`,
          `${suspending?.full_name ?? ""} will no longer be able to sign in. Their records and audit history stay intact, and you can reactivate them at any time.`,
        )}
        confirmLabel={t("স্থগিত করুন", "Suspend")}
        cancelLabel={t("বাতিল", "Cancel")}
        loading={setStatus.isPending}
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
