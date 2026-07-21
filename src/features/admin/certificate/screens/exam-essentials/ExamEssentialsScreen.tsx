import { SettingConfig } from "../../components/SettingConfig";

/** Certificate · Exam Essentials — live jsonb setting. */
export function ExamEssentialsScreen() {
  return (
    <SettingConfig settingKey="exam_essentials" scope="certificate"
      breadcrumb={{ bn: "পরীক্ষা প্রয়োজনীয়তা", en: "Exam Essentials" }}
      title={{ bn: "পরীক্ষা প্রয়োজনীয়তা", en: "Exam Essentials" }}
      subtitle={{ bn: "পরীক্ষার সনদ ও প্রবেশপত্রের সাধারণ তথ্য", en: "Common details for exam certificates and admit cards" }}
      cardTitle={{ bn: "প্রয়োজনীয় তথ্য", en: "Essential Details" }}
      fields={[
        { key: "board", label: { bn: "বোর্ড / কর্তৃপক্ষ", en: "Board / Authority" }, type: "text" },
        { key: "controller", label: { bn: "পরীক্ষা নিয়ন্ত্রক", en: "Controller of Exams" }, type: "text" },
        { key: "signatory", label: { bn: "স্বাক্ষরকারী", en: "Signatory" }, type: "text" },
        { key: "instructions", label: { bn: "সাধারণ নির্দেশনা", en: "General instructions" }, type: "textarea" },
        { key: "show_qr", label: { bn: "QR কোড দেখান", en: "Show QR code" }, type: "toggle" },
      ]} />
  );
}
