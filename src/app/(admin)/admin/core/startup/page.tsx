import { StartupScreen } from "@/features/admin/core/screens/startup/StartupScreen";
import { SettingsGate } from "@/features/admin/core/components/SettingsGate";

export default function Page() {
  return (
    <SettingsGate permission="core.settings">
      <StartupScreen />
    </SettingsGate>
  );
}
