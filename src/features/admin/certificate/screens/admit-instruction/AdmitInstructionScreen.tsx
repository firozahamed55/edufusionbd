import { SettingConfig } from "../../components/SettingConfig";

/** Certificate · Admit Instruction — live jsonb setting. */
export function AdmitInstructionScreen() {
  return (
    <SettingConfig settingKey="admit_instruction" scope="certificate"
      breadcrumb="প্রবেশপত্র নির্দেশনা" title="প্রবেশপত্র নির্দেশনা" subtitle="প্রবেশপত্রে মুদ্রিত নির্দেশনাবলী নির্ধারণ করুন" cardTitle="নির্দেশনা"
      fields={[
        { key: "line1", label: "নির্দেশনা ১", type: "text" },
        { key: "line2", label: "নির্দেশনা ২", type: "text" },
        { key: "line3", label: "নির্দেশনা ৩", type: "text" },
        { key: "notes", label: "অতিরিক্ত নোট", type: "textarea" },
        { key: "show_seat", label: "আসন নম্বর দেখান", type: "toggle" },
        { key: "show_center", label: "কেন্দ্র দেখান", type: "toggle" },
      ]} />
  );
}
