import type { Metadata } from "next";
import { GradingScreen } from "@/features/admin/core/screens/grading/GradingScreen";

export const metadata: Metadata = { title: "Grading Scheme" };

export default function Page() {
  return <GradingScreen />;
}
