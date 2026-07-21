"use client";

import { Megaphone } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import { Badge, EmptyState } from "@/shared/ui";
import { Card } from "@/features/parent/components";
import { NOTICES } from "@/features/parent/data";

export default function ParentNotices() {
  const { t, n } = useT();

  return (
    <div className="flex flex-col gap-3.5">
      <h1 className="text-lg font-bold">{t("নোটিশ ও ঘোষণা", "Notices & announcements")}</h1>

      {NOTICES.length === 0 ? (
        <EmptyState
          icon={<Megaphone size={22} />}
          title={t("কোনো নোটিশ নেই", "No notices yet")}
          description={t("নতুন নোটিশ এলে এখানে দেখতে পাবেন।", "New notices will appear here.")}
        />
      ) : (
        NOTICES.map((notice) => (
          <Card key={notice.id}>
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-subtle text-primary">
                <Megaphone size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-text-primary">
                    {t(notice.title.bn, notice.title.en)}
                  </p>
                  {notice.isNew ? <Badge tone="info" dot>{t("নতুন", "New")}</Badge> : null}
                </div>
                <p className="mt-1 text-meta leading-relaxed text-text-secondary">
                  {t(notice.body.bn, notice.body.en)}
                </p>
                <p className="mt-1.5 text-xs text-text-muted">
                  {n(notice.ageDays)} {t("দিন আগে", "days ago")}
                </p>
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
