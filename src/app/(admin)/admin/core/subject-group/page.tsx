import type { Metadata } from "next";
import { SubjectGroupScreen } from "@/features/admin/core/screens/subject-group/SubjectGroupScreen";

export const metadata: Metadata = { title: "Subject Groups" };

export default function Page() {
  return <SubjectGroupScreen />;
}
