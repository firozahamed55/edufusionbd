import { SettingConfig } from "../../components/SettingConfig";

/** Certificate · Admit Instruction — live jsonb setting. */
export function AdmitInstructionScreen() {
  return (
    <SettingConfig settingKey="admit_instruction" scope="certificate"
      breadcrumb={{ bn: "প্রবেশপত্র নির্দেশনা", en: "Admit Instructions" }}
      title={{ bn: "প্রবেশপত্র নির্দেশনা", en: "Admit Instructions" }}
      subtitle={{ bn: "প্রবেশপত্রে মুদ্রিত নির্দেশনাবলী নির্ধারণ করুন", en: "Define the instructions printed on the admit card" }}
      cardTitle={{ bn: "নির্দেশনা", en: "Instructions" }}
      fields={[
        { key: "line1", label: { bn: "নির্দেশনা ১", en: "Instruction 1" }, type: "text" },
        { key: "line2", label: { bn: "নির্দেশনা ২", en: "Instruction 2" }, type: "text" },
        { key: "line3", label: { bn: "নির্দেশনা ৩", en: "Instruction 3" }, type: "text" },
        { key: "notes", label: { bn: "অতিরিক্ত নোট", en: "Additional notes" }, type: "textarea" },
        { key: "show_seat", label: { bn: "আসন নম্বর দেখান", en: "Show seat number" }, type: "toggle" },
        { key: "show_center", label: { bn: "কেন্দ্র দেখান", en: "Show center" }, type: "toggle" },
      ]} />
  );
}
