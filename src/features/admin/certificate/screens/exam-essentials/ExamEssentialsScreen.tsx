import { SettingConfig } from "../../components/SettingConfig";

/** Certificate · Exam Essentials — live jsonb setting. */
export function ExamEssentialsScreen() {
  return (
    <SettingConfig settingKey="exam_essentials" scope="certificate"
      breadcrumb="পরীক্ষা প্রয়োজনীয়তা" title="পরীক্ষা প্রয়োজনীয়তা" subtitle="পরীক্ষার সনদ ও প্রবেশপত্রের সাধারণ তথ্য" cardTitle="প্রয়োজনীয় তথ্য"
      fields={[
        { key: "board", label: "বোর্ড / কর্তৃপক্ষ", type: "text" },
        { key: "controller", label: "পরীক্ষা নিয়ন্ত্রক", type: "text" },
        { key: "signatory", label: "স্বাক্ষরকারী", type: "text" },
        { key: "instructions", label: "সাধারণ নির্দেশনা", type: "textarea" },
        { key: "show_qr", label: "QR কোড দেখান", type: "toggle" },
      ]} />
  );
}
