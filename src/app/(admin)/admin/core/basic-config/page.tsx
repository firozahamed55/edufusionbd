import type { Metadata } from "next";
import { BasicConfigScreen } from "@/features/admin/core/screens/basic-config/BasicConfigScreen";

export const metadata: Metadata = { title: "Basic Configuration" };

export default function Page() {
  return <BasicConfigScreen />;
}
