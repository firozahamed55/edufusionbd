import { BasicConfigScreen } from "@/features/admin/core/screens/basic-config/BasicConfigScreen";
import { SettingsGate } from "@/features/admin/core/components/SettingsGate";

export default function Page() {
  return (
    <SettingsGate permission="core.settings">
      <BasicConfigScreen />
    </SettingsGate>
  );
}
