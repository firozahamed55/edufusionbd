import { ConfigTab } from "../../components/ConfigTab";

/** Exam · Mark Config — live jsonb config. */
export function MarkConfigScreen() {
  return (
    <ConfigTab kind="mark" active="মার্ক কনফিগ" cardTitle="মার্ক ও পাসিং নিয়ম"
      fields={[
        { key: "full_marks", label: "পূর্ণ নম্বর", type: "number", placeholder: "১০০" },
        { key: "pass_marks", label: "পাস নম্বর", type: "number", placeholder: "৩৩" },
        { key: "cq_ratio", label: "CQ অনুপাত", type: "number", placeholder: "৭০" },
        { key: "mcq_ratio", label: "MCQ অনুপাত", type: "number", placeholder: "৩০" },
        { key: "practical_marks", label: "ব্যবহারিক নম্বর", type: "number", placeholder: "২৫" },
        { key: "absent_as_zero", label: "অনুপস্থিত = ০", type: "toggle" },
      ]} />
  );
}
