import { SignatureScreen } from "@/features/admin/core/screens/signature/SignatureScreen";
import { SettingsGate } from "@/features/admin/core/components/SettingsGate";

export default function Page() {
  return (
    <SettingsGate permission="core.settings">
      <SignatureScreen />
    </SettingsGate>
  );
}
