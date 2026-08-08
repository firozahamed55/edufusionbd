"use client";

import { Fragment } from "react";
import Link from "next/link";
import { Check, Minus, ShieldCheck, Users } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import {
  Skeleton, ErrorState, EmptyState, NoAccessState, PageHeader, LiveRegion, Badge, buttonClass,
  Table, THead, TBody, TR, TH, TD,
} from "@/shared/ui";
import { exportCsv } from "@/shared/lib/exportCsv";
import { localDay } from "@/shared/lib/format";
import { useErrorMessage, classifyError } from "@/shared/services/errors";
import { usePermissionMatrix } from "../../logic/hooks";

/**
 * Core · Permission Matrix (SRA A-0.4 point 4).
 *
 * "Can our accountant see fees but not exam results?" is a procurement
 * question, and until now the honest answer was "the database knows, and
 * nothing can show you". This renders `role_permission` as one role × capability
 * grid: 4 roles, 29 permissions, 9 modules, read in a single RPC.
 *
 * READ-ONLY, and that is the correct scope for this release. The four roles are
 * `is_system` rows seeded per institution, and every RLS policy and RPC guard
 * in the product is written against their permission codes. An editable grid
 * that lets an operator untick `dashboard.view` from `institution_admin`
 * locks the school out of its own product with two clicks and no undo. Custom
 * roles are the feature that makes editing safe, and they are not built.
 *
 * MODULE LABELS. `permission.module` is a code from the seed, so the labels
 * live here rather than in the database — an unknown module falls back to its
 * code instead of throwing, which is the bug the Audit Log's entity list had.
 */

const MODULE_LABEL: Record<string, { bn: string; en: string }> = {
  dashboard: { bn: "ড্যাশবোর্ড", en: "Dashboard" },
  student: { bn: "শিক্ষার্থী", en: "Students" },
  teacher: { bn: "শিক্ষক", en: "Teachers" },
  attendance: { bn: "উপস্থিতি", en: "Attendance" },
  exam: { bn: "পরীক্ষা", en: "Exams" },
  fee: { bn: "ফি ও অর্থ", en: "Fees" },
  sms: { bn: "কমিউনিকেশন", en: "Communication" },
  certificate: { bn: "ডকুমেন্টস", en: "Documents" },
  core: { bn: "সেটিংস", en: "Settings" },
};
const moduleLabel = (m: string) => MODULE_LABEL[m] ?? { bn: m, en: m };

export function PermissionMatrixScreen() {
  const { t, n } = useT();
  const msg = useErrorMessage();
  const q = usePermissionMatrix();

  const roles = q.data?.roles ?? [];
  const permissions = q.data?.permissions ?? [];
  const granted = new Set((q.data?.grants ?? []).map((g) => `${g.role_id}:${g.permission_id}`));
  const has = (roleId: string, permId: string) => granted.has(`${roleId}:${permId}`);

  // `permissions` arrives ordered by module then code, so grouping is a fold
  // rather than a sort — the order the grid renders is the order the database
  // returned, which is the order the seed defines.
  const groups: { module: string; items: typeof permissions }[] = [];
  for (const p of permissions) {
    const last = groups[groups.length - 1];
    if (last && last.module === p.module) last.items.push(p);
    else groups.push({ module: p.module, items: [p] });
  }

  return (
    <div className="flex flex-col gap-5">
      <LiveRegion
        message={
          q.isLoading
            ? t("লোড হচ্ছে", "Loading permission matrix")
            : t(`${n(roles.length)} ভূমিকা, ${n(permissions.length)} অনুমতি`, `${roles.length} roles, ${permissions.length} permissions`)
        }
      />

      <div className="flex flex-wrap items-start gap-3">
        <PageHeader
          className="flex-1"
          crumbs={[
            { label: t("কোর সেটিংস", "Core Settings"), href: "/admin/core/basic-config" },
            { label: t("ব্যবহারকারী", "Users"), href: "/admin/core/user-list" },
            { label: t("অনুমতি ম্যাট্রিক্স", "Permission Matrix") },
          ]}
          title={t("অনুমতি ম্যাট্রিক্স", "Permission Matrix")}
          subtitle={t("কোন ভূমিকা কী করতে পারে", "What each role is allowed to do")}
        />
        <Link href="/admin/core/user-list" className={buttonClass("secondary")}>
          <Users size={16} /> {t("ব্যবহারকারী তালিকা", "User list")}
        </Link>
      </div>

      {/* `fn_permission_matrix` is gated on `core.user_manage` (audit M-2). A
          caller without it gets 42501, which is an access decision, not a
          failure — an ErrorState here would tell an operator to retry
          something that will never work. */}
      {q.isError && classifyError(q.error) === "forbidden" ? (
        <NoAccessState
          title={t("এই পাতা দেখার অনুমতি নেই", "You do not have access to this page")}
          description={t(
            "ভূমিকা ও অনুমতি দেখতে ব্যবহারকারী ব্যবস্থাপনার অনুমতি প্রয়োজন। প্রতিষ্ঠানের অ্যাডমিনকে জানান।",
            "Viewing roles and permissions needs user-management access. Ask your institution's administrator.",
          )}
          permission="core.user_manage"
        />
      ) : q.isError ? (
        <ErrorState title={t("ম্যাট্রিক্স লোড করা যায়নি", "Could not load the matrix")} description={msg(q.error)} />
      ) : q.isLoading ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : roles.length === 0 ? (
        <EmptyState icon={<ShieldCheck size={22} />} title={t("কোনো ভূমিকা নেই", "No roles defined")} />
      ) : (
        <>
          <Table minWidth={280 + roles.length * 150}>
            <THead>
              <TR>
                <TH className="sticky left-0 z-[2] min-w-64 bg-sunken">{t("সক্ষমতা", "Capability")}</TH>
                {roles.map((r) => (
                  <TH key={r.id} className="w-37.5 text-center">
                    <span className="block text-text-primary">{r.name}</span>
                    <span className="block font-latin text-xs font-normal text-text-muted">{r.code}</span>
                  </TH>
                ))}
              </TR>
            </THead>
            <TBody>
              {groups.map((g) => (
                <Fragment key={g.module}>
                  <TR className="bg-sunken">
                    <TH
                      scope="colgroup"
                      colSpan={roles.length + 1}
                      className="sticky left-0 z-[1] bg-sunken text-left text-meta uppercase tracking-wide text-text-muted"
                    >
                      {t(moduleLabel(g.module).bn, moduleLabel(g.module).en)}
                    </TH>
                  </TR>
                  {g.items.map((p) => (
                    <TR key={p.id}>
                      {/* A-7 / WCAG 1.4.10 Reflow: the table scrolls at
                          280 + roles x 150 px, and this column used to scroll
                          away with it — leaving a row of ticks whose subject
                          was off-screen. */}
                      <TH scope="row" className="sticky left-0 z-[1] bg-surface text-left font-normal">
                        <span className="block text-sm text-text-primary">{p.label}</span>
                        <span className="block font-latin text-xs text-text-muted">{p.code}</span>
                      </TH>
                      {roles.map((r) => {
                        const on = has(r.id, p.id);
                        return (
                          <TD key={r.id} className="text-center">
                            {/* The icon is decorative; the cell carries the
                                answer as text for anyone not looking at it. */}
                            <span className="sr-only">
                              {on
                                ? t(`${r.name}: অনুমোদিত`, `${r.name}: allowed`)
                                : t(`${r.name}: অনুমোদিত নয়`, `${r.name}: not allowed`)}
                            </span>
                            <span
                              aria-hidden
                              className={cn(
                                "inline-grid size-6 place-items-center rounded-md",
                                on ? "bg-success-bg text-success-fg" : "text-text-decorative",
                              )}
                            >
                              {on ? <Check size={15} /> : <Minus size={15} />}
                            </span>
                          </TD>
                        );
                      })}
                    </TR>
                  ))}
                </Fragment>
              ))}
            </TBody>
          </Table>

          <div className="flex flex-wrap items-center gap-3">
            <p className="flex-1 text-meta text-text-secondary">
              {roles.some((r) => r.is_system) ? (
                <>
                  <Badge tone="info">{t("সিস্টেম ভূমিকা", "System roles")}</Badge>{" "}
                  {t(
                    "এই ভূমিকাগুলো ডেটাবেসের RLS নীতি ও প্রতিটি RPC গার্ডের ভিত্তি, তাই এখান থেকে সম্পাদনা করা যায় না। কাস্টম ভূমিকা যুক্ত হলে সেগুলো সম্পাদনাযোগ্য হবে।",
                    "These roles are what every RLS policy and RPC guard in the product is written against, so they are not editable here. Custom roles will be.",
                  )}
                </>
              ) : null}
            </p>
            <button
              onClick={() =>
                exportCsv(
                  `permission-matrix-${localDay()}.csv`,
                  permissions.map((p) => ({
                    Module: p.module,
                    Capability: p.label,
                    Code: p.code,
                    ...Object.fromEntries(roles.map((r) => [r.code, has(r.id, p.id) ? "yes" : "no"])),
                  })),
                  { kind: "core.permission_matrix", params: { roles: roles.length, permissions: permissions.length } },
                )
              }
              className={buttonClass("secondary")}
            >
              {t("এক্সপোর্ট", "Export")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
