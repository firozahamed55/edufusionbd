import { ConfigTab } from "../../components/ConfigTab";

/** Exam · Mark Config — live jsonb config. */
export function MarkConfigScreen() {
  return (
    <ConfigTab kind="mark" active="mark" cardTitle={{ bn: "মার্ক ও পাসিং নিয়ম", en: "Marks & Passing Rules" }}
      fields={[
        { key: "full_marks", label: { bn: "পূর্ণ নম্বর", en: "Full marks" }, type: "number", placeholder: { bn: "১০০", en: "100" } },
        { key: "pass_marks", label: { bn: "পাস নম্বর", en: "Pass marks" }, type: "number", placeholder: { bn: "৩৩", en: "33" } },
        { key: "cq_ratio", label: { bn: "CQ অনুপাত", en: "CQ ratio" }, type: "number", placeholder: { bn: "৭০", en: "70" } },
        { key: "mcq_ratio", label: { bn: "MCQ অনুপাত", en: "MCQ ratio" }, type: "number", placeholder: { bn: "৩০", en: "30" } },
        { key: "practical_marks", label: { bn: "ব্যবহারিক নম্বর", en: "Practical marks" }, type: "number", placeholder: { bn: "২৫", en: "25" } },
        { key: "absent_as_zero", label: { bn: "অনুপস্থিত = ০", en: "Absent = 0" }, type: "toggle" },
      ]} />
  );
}
