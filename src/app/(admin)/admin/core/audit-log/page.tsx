import { AuditLogScreen } from "@/features/admin/core/screens/audit-log/AuditLogScreen";
import { SettingsGate } from "@/features/admin/core/components/SettingsGate";

export default function Page() {
  return (
    <SettingsGate permission="audit.read">
      <AuditLogScreen />
    </SettingsGate>
  );
}
