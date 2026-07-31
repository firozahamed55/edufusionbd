"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Send, MessageSquare, Users, AlertTriangle } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import { Field, Input, Select, Textarea, Button, Skeleton, useToast, PageHeader } from "@/shared/ui";
import { smsCost } from "@/shared/lib/sms";
import { useClassSectionsLookup } from "@/shared/services/lookups/hooks";
import type { Option } from "@/shared/services/lookups/api";
import { useSmsAccount, useTemplates, useSendCampaign, useResolvedRecipients } from "../../logic/hooks";
import { useErrorMessage } from "@/shared/services/errors";

const RECIPIENTS = [
  { value: "parent", bn: "অভিভাবক", en: "Parents" },
  { value: "student", bn: "শিক্ষার্থী", en: "Students" },
  { value: "teacher", bn: "শিক্ষক", en: "Teachers" },
];

export function SendScreen() {
  const { t, n, isBn } = useT();
  const msg = useErrorMessage();
  const toast = useToast();
  const account = useSmsAccount();
  const templates = useTemplates();
  const sections = useClassSectionsLookup();
  const send = useSendCampaign();

  /**
   * Recipients handed over from another screen's bulk action (audit W-1).
   * The Teacher List has always navigated here with `?recipients=id,id,…` and
   * NOTHING read it — the selection was silently discarded while the operator
   * believed it had carried over. This is the consumer that makes that
   * handoff real.
   */
  const params = useSearchParams();
  const handedOver = (params.get("recipients") ?? "").split(",").filter(Boolean);

  const [f, setF] = useState({
    recipient_type: handedOver.length > 0 ? "teacher" : "parent",
    recipient_group: "",
    class_section_id: "",
    language: "bn",
    template_id: "",
    body: "",
  });
  const up = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  /**
   * The recipient count is RESOLVED, never typed (SRA F-2a). This is the same
   * function `fn_send_sms_campaign` bills from, so what the operator is quoted
   * below and what the balance is debited by are the same number by
   * construction — not two numbers that happen to agree.
   */
  const isStaff = f.recipient_type === "teacher";
  const resolved = useResolvedRecipients(f.recipient_type, isStaff ? "" : f.class_section_id);
  const people = resolved.data?.count ?? 0;

  // Encoding-aware segments (SRA F-2b). Bangla is UCS-2 at 70 chars a segment,
  // not GSM-7's 160 — the old `ceil(chars/160)` under-counted every Bangla
  // campaign in a Bangla-first product by roughly 2.3x.
  const cost = smsCost(f.body);
  const units = cost.segments * people;
  const rate = account.data?.per_sms_rate ?? 0;
  const balance = account.data?.balance ?? 0;
  const overBalance = units > 0 && units > balance;

  function submit() {
    if (!f.body.trim()) { toast({ title: t("বার্তা লিখুন", "Enter a message"), variant: "error" }); return; }
    if (people === 0) { toast({ title: t("এই নির্বাচনে কোনো প্রাপক নেই", "No recipients for this selection"), variant: "error" }); return; }
    if (overBalance) { toast({ title: t("ব্যালেন্স যথেষ্ট নয়", "Insufficient SMS balance"), variant: "error" }); return; }
    send.mutate(f, {
      onSuccess: () => {
        toast({ title: t(`${n(units)} টি এসএমএস পাঠানো হয়েছে`, `${units} messages sent`), variant: "success" });
        setF({ recipient_type: "parent", recipient_group: "", class_section_id: "", language: "bn", template_id: "", body: "" });
      },
      onError: (e: unknown) => toast({ title: msg(e, { bn: "পাঠানো ব্যর্থ", en: "Send failed" }), variant: "error" }),
    });
  }

  const opt = (list?: Option[]) => (list ?? []).map((o) => ({ value: o.value, label: isBn ? o.label_bn : o.label_en }));
  const bdt = (v: number) => `৳${n(new Intl.NumberFormat("en-IN").format(Math.round(v * 100) / 100))}`;

  return (
    <div className="flex flex-col gap-5 pb-6">
      <header className="flex flex-wrap items-end gap-4">
        <PageHeader
          crumbs={[{ label: t("SMS ও নোটিশ", "SMS & Notice"), href: "/admin/sms-notice/send" }, { label: t("SMS পাঠান", "Send SMS") }]}
          title={t("SMS পাঠান", "Send SMS")}
          subtitle={t("অভিভাবক, শিক্ষার্থী বা শিক্ষকদের বার্তা পাঠান", "Message parents, students or teachers")}
          className="flex-1"
        />
        <div className="rounded-xl bg-primary-subtle px-4 py-2.5 text-center">
          <p className="text-xs text-text-muted">{t("এসএমএস ব্যালেন্স", "SMS balance")}</p>
          <p className="text-lg font-bold text-primary tnum">{n(balance)}</p>
        </div>
      </header>

      {handedOver.length > 0 ? (
        <div className="flex items-center gap-2.5 rounded-xl border border-primary/30 bg-primary-subtle px-4 py-3 text-meta font-medium text-primary">
          <Users size={16} className="shrink-0" />
          <span>
            {t(
              `${n(handedOver.length)} জন প্রাপক নির্বাচিত অবস্থায় আনা হয়েছে`,
              `${handedOver.length} recipients carried over from your selection`,
            )}
          </span>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 rounded-2xl bg-surface p-6 shadow-e1">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={t("প্রাপক", "Recipients")}><Select value={f.recipient_type} options={RECIPIENTS.map((r) => ({ value: r.value, label: isBn ? r.bn : r.en }))} onChange={(e) => up("recipient_type", e.target.value)} /></Field>
          {/*
            A real section reference, not the free-text box it replaced
            (SRA F-2c). "৯ম-ক" typed into an input resolved to nobody; nothing
            in the system ever read it.
          */}
          <Field label={t("শ্রেণি ও শাখা", "Class & section")}>
            <Select
              value={f.class_section_id}
              disabled={isStaff}
              placeholder={isStaff ? t("সকল শিক্ষক", "All staff") : t("সকল শাখা", "All sections")}
              options={opt(sections.data)}
              onChange={(e) => up("class_section_id", e.target.value)}
            />
          </Field>
          <Field label={t("ভাষা", "Language")}><Select value={f.language} options={[{ value: "bn", label: t("বাংলা", "Bangla") }, { value: "en", label: "English" }]} onChange={(e) => up("language", e.target.value)} /></Field>
          <Field label={t("ক্যাম্পেইনের নাম (ঐচ্ছিক)", "Campaign label (optional)")}><Input value={f.recipient_group} onChange={(e) => up("recipient_group", e.target.value)} placeholder={t("যেমন: আগস্টের ফি তাগাদা", "e.g. August fee reminder")} /></Field>
        </div>
        <Field label={t("টেমপ্লেট", "Template")}>
          <Select value={f.template_id} placeholder={t("টেমপ্লেট নির্বাচন (ঐচ্ছিক)", "Pick a template (optional)")} options={(templates.data ?? []).map((x) => ({ value: x.id, label: x.name }))} onChange={(e) => { up("template_id", e.target.value); const tpl = (templates.data ?? []).find((x) => x.id === e.target.value); if (tpl) up("body", tpl.body); }} />
        </Field>
        <Field label={t("বার্তা", "Message")}>
          <Textarea value={f.body} onChange={(e) => up("body", e.target.value)} placeholder={t("এখানে বার্তা লিখুন…", "Type your message…")} className="min-h-32" />
        </Field>

        {/* The bill, before it is incurred. */}
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-border-default bg-sunken p-4 sm:grid-cols-5">
          <Stat label={t("প্রাপক", "Recipients")} loading={resolved.isLoading}
            value={n(people)} hint={resolved.isError ? t("গণনা করা যায়নি", "Could not resolve") : undefined} />
          <Stat label={t("অক্ষর", "Characters")} value={n(cost.chars)} hint={`${cost.encoding} · ${n(cost.perSegment)}/${t("সেগমেন্ট", "seg")}`} />
          <Stat label={t("সেগমেন্ট", "Segments")} value={n(cost.segments)} />
          <Stat label={t("মোট এসএমএস", "Total messages")} value={n(units)} hint={t("সেগমেন্ট × প্রাপক", "segments × recipients")} />
          <Stat label={t("আনুমানিক খরচ", "Estimated cost")} value={bdt(units * rate)} />
        </div>

        {overBalance ? (
          <div className="flex items-start gap-2.5 rounded-xl border border-danger-fg/30 bg-danger-bg px-4 py-3 text-meta text-danger-fg">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <p>{t(
              `এই ক্যাম্পেইনে ${n(units)} টি এসএমএস দরকার, ব্যালেন্সে আছে ${n(balance)} টি। প্যাকেজ কিনুন বা প্রাপক কমান।`,
              `This campaign needs ${units} messages but the balance is ${balance}. Buy a package or narrow the audience.`,
            )}</p>
          </div>
        ) : null}

        {resolved.data && resolved.data.sample.length > 0 ? (
          <p className="text-meta text-text-muted">
            {t("যেমন", "For example")}: {resolved.data.sample.slice(0, 3).map((r) => r.name).join(" · ")}
            {people > 3 ? t(` এবং আরও ${n(people - 3)} জন`, ` and ${people - 3} more`) : ""}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1" />
          <Button variant="primary" onClick={submit} disabled={send.isPending || people === 0 || overBalance}>
            <Send size={16} /> {send.isPending ? t("পাঠানো হচ্ছে…", "Sending…") : t("পাঠান", "Send")}
          </Button>
        </div>
        <div className="flex items-start gap-2.5 rounded-xl border border-info-fg/30 bg-info-bg px-4 py-3 text-meta text-info-fg">
          <MessageSquare size={16} className="mt-0.5 shrink-0" />
          <p>{t("প্রাপক সংখ্যা রোস্টার থেকে নেওয়া হয় — ব্যালেন্স ঠিক এই সংখ্যা অনুযায়ী কাটা হবে। প্রকৃত ডেলিভারি গেটওয়ে ইন্টিগ্রেশনের পর সক্রিয় হবে।", "The recipient count comes from the roster, and the balance is debited by exactly the figure shown above. Actual delivery activates after gateway integration.")}</p>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, hint, loading }: { label: string; value: string; hint?: string; loading?: boolean }) {
  return (
    <div>
      <p className="text-xs text-text-muted">{label}</p>
      {loading ? <Skeleton className="mt-1 h-6 w-16" /> : <p className="text-base font-bold text-text-primary tnum">{value}</p>}
      {hint ? <p className="text-xs text-text-muted font-latin">{hint}</p> : null}
    </div>
  );
}
