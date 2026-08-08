import type { Metadata } from "next";
import { SubjectScreen } from "@/features/admin/core/screens/subject/SubjectScreen";

export const metadata: Metadata = { title: "Subject List" };

export default function Page() {
  return <SubjectScreen />;
}
