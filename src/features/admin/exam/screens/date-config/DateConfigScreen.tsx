import { ConfigTab } from "../../components/ConfigTab";

/** Exam · Date Config — live jsonb config. */
export function DateConfigScreen() {
  return (
    <ConfigTab kind="date" active="date" cardTitle={{ bn: "ফলাফল প্রকাশ", en: "Result Publishing" }}
      fields={[
        { key: "publish_mode", label: { bn: "প্রকাশ মোড", en: "Publish mode" }, type: "text", placeholder: { bn: "নির্ধারিত তারিখে", en: "On scheduled date" } },
        { key: "publish_date", label: { bn: "প্রকাশ তারিখ", en: "Publish date" }, type: "text", placeholder: { bn: "দিন/মাস/বছর", en: "DD/MM/YYYY" } },
        { key: "auto_merit", label: { bn: "স্বয়ংক্রিয় মেধাক্রম", en: "Auto merit rank" }, type: "toggle" },
        { key: "sms_on_publish", label: { bn: "প্রকাশে SMS", en: "SMS on publish" }, type: "toggle" },
      ]} />
  );
}
