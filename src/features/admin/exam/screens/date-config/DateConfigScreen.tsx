import { ConfigTab } from "../../components/ConfigTab";

/** Exam · Date Config — live jsonb config. */
export function DateConfigScreen() {
  return (
    <ConfigTab kind="date" active="তারিখ কনফিগ" cardTitle="ফলাফল প্রকাশ"
      fields={[
        { key: "publish_mode", label: "প্রকাশ মোড", type: "text", placeholder: "নির্ধারিত তারিখে" },
        { key: "publish_date", label: "প্রকাশ তারিখ", type: "text", placeholder: "দিন/মাস/বছর" },
        { key: "auto_merit", label: "স্বয়ংক্রিয় মেধাক্রম", type: "toggle" },
        { key: "sms_on_publish", label: "প্রকাশে SMS", type: "toggle" },
      ]} />
  );
}
