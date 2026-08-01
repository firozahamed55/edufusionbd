import { GradingScreen } from "@/features/admin/core/screens/grading/GradingScreen";
import { SettingsGate } from "@/features/admin/core/components/SettingsGate";

export default function Page() {
  return (
    <SettingsGate permission="core.settings">
      <GradingScreen />
    </SettingsGate>
  );
}
