import { PermissionMatrixScreen } from "@/features/admin/core/screens/permissions/PermissionMatrixScreen";
import { SettingsGate } from "@/features/admin/core/components/SettingsGate";

export default function Page() {
  return (
    <SettingsGate permission="core.user_manage">
      <PermissionMatrixScreen />
    </SettingsGate>
  );
}
