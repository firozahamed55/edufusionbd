import { CalendarScreen } from "@/features/admin/core/screens/calendar/CalendarScreen";
import { SettingsGate } from "@/features/admin/core/components/SettingsGate";

export default function Page() {
  return (
    <SettingsGate permission="core.settings">
      <CalendarScreen />
    </SettingsGate>
  );
}
