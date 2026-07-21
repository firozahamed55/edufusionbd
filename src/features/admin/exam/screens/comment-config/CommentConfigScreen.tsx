import { ConfigTab } from "../../components/ConfigTab";

/** Exam · Comment Config — live jsonb config. */
export function CommentConfigScreen() {
  return (
    <ConfigTab kind="comment" active="comment" cardTitle={{ bn: "মন্তব্য টেমপ্লেট", en: "Comment Templates" }}
      fields={[
        { key: "pass_comment", label: { bn: "উত্তীর্ণ মন্তব্য", en: "Pass comment" }, type: "text", placeholder: { bn: "অসাধারণ ফলাফল", en: "Excellent result" } },
        { key: "fail_comment", label: { bn: "অকৃতকার্য মন্তব্য", en: "Fail comment" }, type: "text", placeholder: { bn: "আরও চেষ্টা করো", en: "Try harder" } },
        { key: "show_teacher_remark", label: { bn: "শিক্ষকের মন্তব্য", en: "Teacher's remark" }, type: "toggle" },
      ]} />
  );
}
