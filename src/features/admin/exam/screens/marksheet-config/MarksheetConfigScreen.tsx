import { ConfigTab } from "../../components/ConfigTab";

/** Exam · Marksheet Config — live jsonb config. */
export function MarksheetConfigScreen() {
  return (
    <ConfigTab kind="marksheet" active="মার্কশিট কনফিগ" cardTitle="মার্কশিট ফরমেট"
      fields={[
        { key: "format", label: "ফরমেট", type: "text", placeholder: "বিস্তারিত" },
        { key: "show_merit", label: "মেধাক্রম দেখান", type: "toggle" },
        { key: "show_signature", label: "স্বাক্ষরের স্থান", type: "toggle" },
        { key: "show_comment", label: "মন্তব্য দেখান", type: "toggle" },
        { key: "show_attendance", label: "উপস্থিতি দেখান", type: "toggle" },
      ]} />
  );
}
