import type { Metadata } from "next";
import { ClassScreen } from "@/features/admin/core/screens/class/ClassScreen";

export const metadata: Metadata = { title: "Classes & Sections" };

export default function Page() {
  return <ClassScreen />;
}
