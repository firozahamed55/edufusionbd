"use client";

import Link from "next/link";
import { Megaphone } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import { Badge } from "@/shared/ui";
import { Card, CardHead, CardMore } from "@/features/parent/components";
import { useActiveChild } from "@/features/parent/state";
import { NOTICES } from "@/features/parent/data";

/**
 * Parent dashboard (home) — matched to the Figma parent shot: today's
 * attendance, fees & money, latest result, latest notice. Reads the
 * active child from context, so switching child updates every card in place.
 */
export default function ParentHome() {
  const { t, n } = useT();
  const { active } = useActiveChild();
  const notice = NOTICES[0];

  return (
    <div className="flex flex-col gap-3.5">
      {/* Today's attendance */}
      <Card href="/parent/attendance">
        <CardHead
          title={t("আজকের উপস্থিতি", "Today's attendance")}
          trailing={
            <Badge tone={active.todayStatus === "present" ? "success" : "danger"} dot>
              {active.todayStatus === "present" ? t("উপস্থিত", "Present") : t("অনুপস্থিত", "Absent")}
            </Badge>
          }
        />
        <div className="flex items-end gap-3">
          <p className="text-4xl font-black tnum">{n(active.attendancePct)}%</p>
          <p className="pb-1.5 text-meta text-text-muted">
            {t("এই মাসে", "This month")} · {n(active.presentDays)} / {n(active.totalDays)}{" "}
            {t("দিন", "days")}
          </p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-sunken">
          <div
            className="h-full rounded-full bg-success-fg transition-all duration-500"
            style={{ width: `${active.attendancePct}%` }}
          />
        </div>
      </Card>

      {/* Fees & money */}
      <Card>
        <CardHead
          title={t("ফি ও অর্থ", "Fees & money")}
          trailing={
            active.feeDue > 0 ? (
              <Badge tone="warning" dot>{t("বকেয়া", "Due")}</Badge>
            ) : (
              <Badge tone="success" dot>{t("পরিশোধিত", "Paid")}</Badge>
            )
          }
        />
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-3xl font-black tnum">৳{n(active.feeDue.toLocaleString("en-US"))}</p>
            <p className="mt-1 text-meta text-text-muted">
              {t(active.feeMonth.bn, active.feeMonth.en)} · {t(active.feeDueDate.bn, active.feeDueDate.en)}
            </p>
          </div>
          {active.feeDue > 0 ? (
            <Link
              href="/parent/fees"
              className="shrink-0 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-text-on-primary transition-colors hover:bg-primary-hover"
            >
              {t("পরিশোধ করুন", "Pay now")}
            </Link>
          ) : null}
        </div>
      </Card>

      {/* Latest result */}
      <Card>
        <CardHead
          title={t("সর্বশেষ ফলাফল", "Latest result")}
          trailing={<Badge tone="success" dot>{t("প্রকাশিত", "Published")}</Badge>}
        />
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-3xl font-black tnum">GPA {n(active.gpa)}</p>
            <p className="mt-1 text-meta text-text-muted">
              {t(active.examName.bn, active.examName.en)} · {t("মেধাক্রম", "Merit")} {n(active.meritPosition)}
              {t("য়", "")}
            </p>
          </div>
          <CardMore href="/parent/results" label={t("মার্কশিট", "Marksheet")} />
        </div>
      </Card>

      {/* Latest notice */}
      <Card href="/parent/notices">
        <CardHead
          title={t("নোটিশ", "Notice")}
          trailing={notice.isNew ? <Badge tone="info" dot>{t("নতুন", "New")}</Badge> : null}
        />
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-subtle text-primary">
            <Megaphone size={18} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-text-primary">{t(notice.title.bn, notice.title.en)}</p>
            <p className="mt-0.5 text-meta text-text-muted">
              {n(notice.ageDays)} {t("দিন আগে", "days ago")}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
