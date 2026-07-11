import { ConfigTab } from "../../components/ConfigTab";

/** Exam · Comment Config — live jsonb config. */
export function CommentConfigScreen() {
  return (
    <ConfigTab kind="comment" active="মন্তব্য কনফিগ" cardTitle="মন্তব্য টেমপ্লেট"
      fields={[
        { key: "pass_comment", label: "উত্তীর্ণ মন্তব্য", type: "text", placeholder: "অসাধারণ ফলাফল" },
        { key: "fail_comment", label: "অকৃতকার্য মন্তব্য", type: "text", placeholder: "আরও চেষ্টা করো" },
        { key: "show_teacher_remark", label: "শিক্ষকের মন্তব্য", type: "toggle" },
      ]} />
  );
}
