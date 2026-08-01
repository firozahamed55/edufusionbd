import { SubjectScreen } from "@/features/admin/core/screens/subject/SubjectScreen";
import { SettingsGate } from "@/features/admin/core/components/SettingsGate";

export default function Page() {
  return (
    <SettingsGate permission="core.settings">
      <SubjectScreen />
    </SettingsGate>
  );
}
