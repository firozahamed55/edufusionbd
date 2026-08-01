import { ClassScreen } from "@/features/admin/core/screens/class/ClassScreen";
import { SettingsGate } from "@/features/admin/core/components/SettingsGate";

export default function Page() {
  return (
    <SettingsGate permission="core.settings">
      <ClassScreen />
    </SettingsGate>
  );
}
