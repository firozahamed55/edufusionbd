"use client";

import { Sparkles, MessageSquareText, FileSearch, Wand2 } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import { PageHeader, EmptyState } from "@/shared/ui";

/**
 * EduSathi AI — the product's stated key differentiator (see
 * BasicConfigScreen's `edusathi_ai_assistant` toggle). This route previously
 * 404'd (adminNav.ts pointed at it with no page underneath). The assistant
 * itself isn't built yet — this is an honest "not yet available" landing,
 * not a fabricated chat UI, so it stays truthful until the real backend lands.
 */
export function EdusathiScreen() {
  const { t } = useT();

  const capabilities = [
    {
      icon: MessageSquareText,
      title: t("প্রশ্ন-উত্তর", "Ask anything"),
      desc: t(
        "শিক্ষার্থী, ফি বা উপস্থিতি নিয়ে সরাসরি প্রশ্ন করুন",
        "Ask about a student, a fee, or attendance in plain language",
      ),
    },
    {
      icon: FileSearch,
      title: t("দ্রুত অনুসন্ধান", "Instant lookups"),
      desc: t(
        "রেকর্ড খুঁজতে মেনু ঘাঁটার বদলে সরাসরি জিজ্ঞাসা করুন",
        "Find a record without hunting through menus",
      ),
    },
    {
      icon: Wand2,
      title: t("কাজ স্বয়ংক্রিয়", "Guided actions"),
      desc: t(
        "এসএমএস পাঠানো বা রিপোর্ট তৈরির মতো কাজ চালান",
        "Kick off tasks like sending an SMS or building a report",
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        crumbs={[{ label: t("ড্যাশবোর্ড", "Dashboard"), href: "/admin/dashboard" }, { label: "EduSathi AI" }]}
        title={t("এডুসাথী এআই", "EduSathi AI")}
        subtitle={t(
          "প্রতিষ্ঠানের জন্য একটি এআই সহকারী — শীঘ্রই আসছে",
          "An AI assistant for your institution — coming soon",
        )}
      />

      <div className="grad-indigo flex items-center gap-4 rounded-2xl p-5 text-white shadow-e1">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/15">
          <Sparkles size={24} aria-hidden />
        </span>
        <div>
          <p className="text-body font-semibold">{t("এডুসাথী এআই সহকারী", "EduSathi AI Assistant")}</p>
          <p className="mt-0.5 text-meta text-white/80">
            {t(
              "কোর সেটিংসে সক্রিয় করা হলে এখানে চালু হবে",
              "Will activate here once enabled in Core Settings",
            )}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {capabilities.map((c) => (
          <div key={c.title} className="flex flex-col gap-2 rounded-2xl border border-border-default bg-surface p-4 shadow-e1">
            <span className="grid size-9 place-items-center rounded-[10px] bg-primary-subtle text-primary">
              <c.icon size={18} aria-hidden />
            </span>
            <p className="text-sm font-semibold text-text-primary">{c.title}</p>
            <p className="text-meta text-text-muted">{c.desc}</p>
          </div>
        ))}
      </div>

      <EmptyState
        icon={<Sparkles size={22} aria-hidden />}
        title={t("এই ফিচারটি তৈরি হচ্ছে", "This feature is under development")}
        description={t(
          "এডুসাথী এআই সহকারী শীঘ্রই এখানে যুক্ত হবে। এখন পর্যন্ত এটি ব্যবহারযোগ্য নয়।",
          "The EduSathi AI assistant is coming to this screen soon. It isn't usable yet.",
        )}
      />
    </div>
  );
}
