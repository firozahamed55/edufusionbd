import type { Metadata } from "next";
import { StartupScreen } from "@/features/admin/core/screens/startup/StartupScreen";

export const metadata: Metadata = { title: "Institution Identity" };

export default function Page() {
  return <StartupScreen />;
}
