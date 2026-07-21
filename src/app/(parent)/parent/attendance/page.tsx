"use client";

import { CheckCircle2, XCircle, MinusCircle } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import { Badge } from "@/shared/ui";
import { Card, CardHead } from "@/features/parent/components";
import { useActiveChild } from "@/features/parent/state";

type Day = { day: number; status: "present" | "absent" | "leave" | "holiday" };

// Demo month grid — replaced by an attendance query keyed to the active child.
const MONTH: Day[] = Array.from({ length: 30 }, (_, i) => {
  const day = i + 1;
  const status: Day["status"] =
    day % 7 === 6 || day % 7 === 0 ? "holiday" : day === 9 ? "absent" : day === 18 ? "leave" : "present";
  return { day, status };
});

export default function ParentAttendance() {
  const { t, n } = useT();
  const { active } = useActiveChild();

  const present = MONTH.filter((d) => d.status === "present").length;
  const absent = MONTH.filter((d) => d.status === "absent").length;
  const leave = MONTH.filter((d) => d.status === "leave").length;

  const cell: Record<Day["status"], string> = {
    present: "bg-success-bg text-success-fg",
    absent: "bg-danger-bg text-danger-fg",
    leave: "bg-warning-bg text-warning-fg",
    holiday: "bg-sunken text-text-muted",
  };

  return (
    <div className="flex flex-col gap-3.5">
      <h1 className="text-lg font-bold">{t("উপস্থিতি", "Attendance")}</h1>

      <Card>
        <CardHead
          title={t("এই মাসের সারাংশ", "This month")}
          trailing={<Badge tone="success" dot>{n(active.attendancePct)}%</Badge>}
        />
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: CheckCircle2, tone: "text-success-fg", label: t("উপস্থিত", "Present"), v: present },
            { icon: XCircle, tone: "text-danger-fg", label: t("অনুপস্থিত", "Absent"), v: absent },
            { icon: MinusCircle, tone: "text-warning-fg", label: t("ছুটি", "Leave"), v: leave },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="rounded-xl bg-sunken p-3 text-center">
                <Icon size={18} className={`mx-auto ${s.tone}`} />
                <p className="mt-1 text-xl font-bold tnum">{n(s.v)}</p>
                <p className="text-micro text-text-muted">{s.label}</p>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardHead title={t("দৈনিক উপস্থিতি", "Daily record")} />
        <div className="grid grid-cols-7 gap-1.5">
          {MONTH.map((d) => (
            <div
              key={d.day}
              className={`grid aspect-square place-items-center rounded-lg text-meta font-semibold tnum ${cell[d.status]}`}
              title={d.status}
            >
              {n(d.day)}
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-micro text-text-muted">
          <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-success-fg" />{t("উপস্থিত", "Present")}</span>
          <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-danger-fg" />{t("অনুপস্থিত", "Absent")}</span>
          <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-warning-fg" />{t("ছুটি", "Leave")}</span>
        </div>
      </Card>
    </div>
  );
}
