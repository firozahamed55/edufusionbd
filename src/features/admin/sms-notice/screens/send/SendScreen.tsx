"use client";

import { useState } from "react";
import { Send, MessageSquare } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import { Field, Input, Select, Textarea, Button, useToast } from "@/shared/ui";
import { useSmsAccount, useTemplates, useSendCampaign } from "../../logic/hooks";

const RECIPIENTS = [
  { value: "parent", bn: "অভিভাবক", en: "Parents" },
  { value: "student", bn: "শিক্ষার্থী", en: "Students" },
  { value: "teacher", bn: "শিক্ষক", en: "Teachers" },
];

export function SendScreen() {
  const { t, n, isBn } = useT();
  const toast = useToast();
  const account = useSmsAccount();
  const templates = useTemplates();
  const send = useSendCampaign();
  const [f, setF] = useState({ recipient_type: "parent", recipient_group: "", language: "bn", template_id: "", body: "", recipient_count: "" });
  const up = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  function pickTemplate(id: string) {
    up("template_id", id);
    const tpl = (templates.data ?? []).find((x) => x.id === id);
    if (tpl) up("body", tpl.body);
  }

  function submit() {
    if (!f.body.trim()) { toast({ title: t("বার্তা লিখুন", "Enter a message"), variant: "error" }); return; }
    send.mutate(f, {
      onSuccess: () => { toast({ title: t("SMS ক্যাম্পেইন পাঠানো হয়েছে", "SMS campaign sent"), variant: "success" }); setF({ recipient_type: "parent", recipient_group: "", language: "bn", template_id: "", body: "", recipient_count: "" }); },
      onError: (e: unknown) => toast({ title: e instanceof Error ? e.message : t("পাঠানো ব্যর্থ", "Send failed"), variant: "error" }),
    });
  }

  const chars = f.body.length;
  const segments = Math.max(1, Math.ceil(chars / 160));

  return (
    <div className="flex flex-col gap-5 pb-6">
      <header className="flex flex-wrap items-end gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-1.5 text-meta text-text-muted"><span>{t("SMS ও নোটিশ", "SMS & Notice")}</span><span>›</span><span className="text-text-secondary">{t("SMS পাঠান", "Send SMS")}</span></div>
          <h1 className="mt-1.5 text-h4 font-bold text-text-primary">{t("SMS পাঠান", "Send SMS")}</h1>
          <p className="mt-1 text-meta text-text-muted">{t("অভিভাবক, শিক্ষার্থী বা শিক্ষকদের বার্তা পাঠান", "Message parents, students or teachers")}</p>
        </div>
        <div className="rounded-xl bg-primary-subtle px-4 py-2.5 text-center">
          <p className="text-xs text-text-muted">{t("এসএমএস ব্যালেন্স", "SMS balance")}</p>
          <p className="text-lg font-bold text-primary tnum">{n(account.data?.balance ?? 0)}</p>
        </div>
      </header>

      <div className="flex flex-col gap-4 rounded-2xl bg-surface p-6 shadow-e3">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={t("প্রাপক", "Recipients")}><Select value={f.recipient_type} options={RECIPIENTS.map((r) => ({ value: r.value, label: isBn ? r.bn : r.en }))} onChange={(e) => up("recipient_type", e.target.value)} /></Field>
          <Field label={t("গ্রুপ (শ্রেণি/শাখা)", "Group (class/section)")}><Input value={f.recipient_group} onChange={(e) => up("recipient_group", e.target.value)} placeholder={t("যেমন: ৯ম-ক", "e.g. 9-A")} /></Field>
          <Field label={t("ভাষা", "Language")}><Select value={f.language} options={[{ value: "bn", label: t("বাংলা", "Bangla") }, { value: "en", label: "English" }]} onChange={(e) => up("language", e.target.value)} /></Field>
          <Field label={t("প্রাপক সংখ্যা (আনুমানিক)", "Recipient count (est.)")}><Input type="number" value={f.recipient_count} onChange={(e) => up("recipient_count", e.target.value)} className="font-latin" /></Field>
        </div>
        <Field label={t("টেমপ্লেট", "Template")}>
          <Select value={f.template_id} placeholder={t("টেমপ্লেট নির্বাচন (ঐচ্ছিক)", "Pick a template (optional)")} options={(templates.data ?? []).map((x) => ({ value: x.id, label: x.name }))} onChange={(e) => pickTemplate(e.target.value)} />
        </Field>
        <Field label={t("বার্তা", "Message")}>
          <Textarea value={f.body} onChange={(e) => up("body", e.target.value)} placeholder={t("এখানে বার্তা লিখুন…", "Type your message…")} className="min-h-32" />
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[12.5px] text-text-muted">{t("অক্ষর", "Chars")}: <b className="tnum">{n(chars)}</b> · {t("সেগমেন্ট", "Segments")}: <b className="tnum">{n(segments)}</b></span>
          <div className="flex-1" />
          <Button variant="primary" onClick={submit} disabled={send.isPending}><Send size={16} /> {send.isPending ? t("পাঠানো হচ্ছে…", "Sending…") : t("পাঠান", "Send")}</Button>
        </div>
        <div className="flex items-start gap-2.5 rounded-xl border border-info-fg/30 bg-info-bg px-4 py-3 text-[12.5px] text-info-fg">
          <MessageSquare size={16} className="mt-0.5 shrink-0" />
          <p>{t("বার্তাটি রেকর্ড করা হবে ও ব্যালেন্স থেকে প্রাপক সংখ্যা অনুযায়ী কেটে নেওয়া হবে। প্রকৃত ডেলিভারি গেটওয়ে ইন্টিগ্রেশনের পর সক্রিয় হবে।", "The campaign is recorded and the balance is debited by the recipient count. Actual delivery activates after gateway integration.")}</p>
        </div>
      </div>
    </div>
  );
}
