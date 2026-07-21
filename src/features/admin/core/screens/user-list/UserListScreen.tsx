"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { Skeleton, EmptyState, ErrorState, Breadcrumb, Pagination } from "@/shared/ui";
import { useUsers } from "../../logic/hooks";

const statusTone: Record<string, string> = { active: "bg-success-bg text-success-fg", suspended: "bg-danger-bg text-danger-fg", invited: "bg-warning-bg text-warning-fg" };
const PER_PAGE = 25;

export function UserListScreen() {
  const { t, isBn } = useT();
  const [page, setPage] = useState(1);
  const q = useUsers(page);
  const rows = q.data?.rows ?? [];
  const total = q.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="flex flex-col gap-5">
      <header>
        <Breadcrumb items={[{ label: t("কোর সেটিংস", "Core Settings"), href: "/admin/core/basic-config" }, { label: t("ব্যবহারকারী", "Users") }]} />
        <h1 className="mt-1.5 text-h4 font-bold text-text-primary">{t("ব্যবহারকারী ব্যবস্থাপনা", "User Management")}</h1>
        <p className="mt-1 text-meta text-text-muted">{t("প্রতিষ্ঠানের ব্যবহারকারী ও তাদের ভূমিকা", "Institution users and their roles")}</p>
      </header>

      {q.isLoading ? (
        <div className="flex flex-col gap-2 rounded-2xl bg-surface p-5 shadow-e3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-11" />)}</div>
      ) : q.isError ? (
        <ErrorState title={t("ব্যবহারকারী লোড করা যায়নি", "Could not load users")} />
      ) : rows.length === 0 ? (
        <EmptyState icon={<Users size={22} />} title={t("কোনো ব্যবহারকারী নেই", "No users yet")} />
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-surface shadow-e3">
          <div className="min-w-160">
            <div className="flex items-center gap-3 border-b border-border-default px-5 py-4"><p className="flex-1 text-base font-semibold text-text-primary">{t("ব্যবহারকারী তালিকা", "Users")}</p></div>
            <div className="flex items-center gap-3 border-b border-border-default px-5 py-3 text-[12.5px] font-semibold text-text-muted">
              <div className="flex-1">{t("নাম", "Name")}</div>
              <div className="w-40">{t("ফোন", "Phone")}</div>
              <div className="w-48">{t("ভূমিকা", "Roles")}</div>
              <div className="w-28 text-center">{t("স্ট্যাটাস", "Status")}</div>
            </div>
            {rows.map((r, i) => (
              <div key={r.id} className={cn("flex items-center gap-3 px-5 py-3.5", i % 2 === 1 && "bg-sunken")}>
                <div className="flex-1 text-sm font-medium text-text-primary">{r.full_name ?? "—"}</div>
                <div className="w-40 font-latin text-meta text-text-secondary">{r.phone ?? "—"}</div>
                <div className="w-48 text-meta text-text-secondary">{r.roles || "—"}</div>
                <div className="w-28 text-center"><span className={cn("inline-block rounded-full px-2.5 py-1 text-xs font-semibold", statusTone[r.status] ?? "bg-sunken text-text-secondary")}>{r.status}</span></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {total > 0 ? (
        <Pagination
          label={t(
            `${(page - 1) * PER_PAGE + 1}–${Math.min(page * PER_PAGE, total)} দেখানো হচ্ছে · মোট ${total} জন`,
            `Showing ${(page - 1) * PER_PAGE + 1}-${Math.min(page * PER_PAGE, total)} of ${total}`,
          )}
          pages={pages}
          current={page}
          onPageChange={setPage}
        />
      ) : null}
      <p className="text-[12.5px] text-text-muted">{t("* নতুন ব্যবহারকারী তৈরি Supabase Auth-এর মাধ্যমে হয় (আমন্ত্রণ প্রবাহ পরবর্তী ধাপে যুক্ত হবে)।", isBn ? "" : "* New users are provisioned via Supabase Auth (invite flow added later).")}</p>
    </div>
  );
}
