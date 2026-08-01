import { SubjectGroupScreen } from "@/features/admin/core/screens/subject-group/SubjectGroupScreen";
import { SettingsGate } from "@/features/admin/core/components/SettingsGate";

export default function Page() {
  return (
    <SettingsGate permission="core.settings">
      <SubjectGroupScreen />
    </SettingsGate>
  );
}
