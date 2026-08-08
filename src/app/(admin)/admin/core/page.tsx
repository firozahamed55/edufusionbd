import type { Metadata } from "next";
import { SettingsHubScreen } from "@/features/admin/core/screens/hub/SettingsHubScreen";

export const metadata: Metadata = { title: "Settings" };

export default function Page() {
  return <SettingsHubScreen />;
}
