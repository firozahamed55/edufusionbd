import { UserListScreen } from "@/features/admin/core/screens/user-list/UserListScreen";
import { SettingsGate } from "@/features/admin/core/components/SettingsGate";

export default function Page() {
  return (
    <SettingsGate permission="core.user_manage">
      <UserListScreen />
    </SettingsGate>
  );
}
