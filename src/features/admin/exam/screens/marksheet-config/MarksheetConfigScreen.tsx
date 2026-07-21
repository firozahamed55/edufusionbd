import { ConfigTab } from "../../components/ConfigTab";

/** Exam · Marksheet Config — live jsonb config. */
export function MarksheetConfigScreen() {
  return (
    <ConfigTab kind="marksheet" active="marksheet" cardTitle={{ bn: "মার্কশিট ফরমেট", en: "Marksheet Format" }}
      fields={[
        { key: "format", label: { bn: "ফরমেট", en: "Format" }, type: "text", placeholder: { bn: "বিস্তারিত", en: "Detailed" } },
        { key: "show_merit", label: { bn: "মেধাক্রম দেখান", en: "Show merit rank" }, type: "toggle" },
        { key: "show_signature", label: { bn: "স্বাক্ষরের স্থান", en: "Signature space" }, type: "toggle" },
        { key: "show_comment", label: { bn: "মন্তব্য দেখান", en: "Show comment" }, type: "toggle" },
        { key: "show_attendance", label: { bn: "উপস্থিতি দেখান", en: "Show attendance" }, type: "toggle" },
      ]} />
  );
}
