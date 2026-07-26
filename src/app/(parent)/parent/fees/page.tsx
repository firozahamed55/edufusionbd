"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import { Badge } from "@/shared/ui";
import { Card, CardHead } from "@/features/parent/components";
import { useActiveChild } from "@/features/parent/state";

type Line = { bn: string; en: string; amount: number };
type Payment = { bn: string; en: string; amount: number; date: { bn: string; en: string }; method: string };

const LINES: Line[] = [
  { bn: "মাসিক বেতন", en: "Monthly tuition", amount: 2500 },
  { bn: "পরীক্ষা ফি", en: "Exam fee", amount: 500 },
  { bn: "লাইব্রেরি", en: "Library", amount: 200 },
];

const HISTORY: Payment[] = [
  { bn: "মে ২০২৬", en: "May 2026", amount: 3200, date: { bn: "১০ মে", en: "10 May" }, method: "bKash" },
  { bn: "এপ্রিল ২০২৬", en: "April 2026", amount: 3200, date: { bn: "০৮ এপ্রিল", en: "08 Apr" }, method: "Nagad" },
];

export default function ParentFees() {
  const { t, n } = useT();
  const { active } = useActiveChild();
  const [paid, setPaid] = useState(active.feeDue === 0);

  const total = LINES.reduce((s, l) => s + l.amount, 0);

  return (
    <div className="flex flex-col gap-3.5">
      <h1 className="text-lg font-bold">{t("ফি ও অর্থ", "Fees & money")}</h1>

      <Card>
        <CardHead
          title={t(active.feeMonth.bn, active.feeMonth.en)}
          trailing={
            paid ? (
              <Badge tone="success" dot>{t("পরিশোধিত", "Paid")}</Badge>
            ) : (
              <Badge tone="warning" dot>{t("বকেয়া", "Due")}</Badge>
            )
          }
        />
        <ul className="flex flex-col divide-y divide-border-default">
          {LINES.map((l) => (
            <li key={l.en} className="flex items-center justify-between py-2.5 text-sm">
              <span className="text-text-secondary">{t(l.bn, l.en)}</span>
              <span className="tnum text-text-primary">৳{n(l.amount.toLocaleString("en-US"))}</span>
            </li>
          ))}
          <li className="flex items-center justify-between py-2.5 text-base font-bold">
            <span>{t("মোট", "Total")}</span>
            <span className="tnum">৳{n(total.toLocaleString("en-US"))}</span>
          </li>
        </ul>

        {paid ? (
          <div className="mt-2 flex items-center gap-2 rounded-lg bg-success-bg px-3 py-2.5 text-sm text-success-fg">
            <CheckCircle2 size={18} /> {t("এই মাসের ফি পরিশোধিত", "This month's fees are paid")}
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setPaid(true)}
              className="rounded-lg bg-brand-bkash py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              {t("bKash-এ পরিশোধ", "Pay with bKash")}
            </button>
            <button
              type="button"
              onClick={() => setPaid(true)}
              className="rounded-lg bg-brand-nagad py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              {t("Nagad-এ পরিশোধ", "Pay with Nagad")}
            </button>
          </div>
        )}
      </Card>

      <Card>
        <CardHead title={t("পরিশোধের ইতিহাস", "Payment history")} />
        <ul className="flex flex-col divide-y divide-border-default">
          {HISTORY.map((p) => (
            <li key={p.en} className="flex items-center justify-between py-2.5">
              <div>
                <p className="text-sm font-medium text-text-primary">{t(p.bn, p.en)}</p>
                <p className="text-xs text-text-muted">
                  {t(p.date.bn, p.date.en)} · {p.method}
                </p>
              </div>
              <span className="tnum text-sm font-semibold text-success-fg">
                ৳{n(p.amount.toLocaleString("en-US"))}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
