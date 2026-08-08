import type { Metadata } from "next";
import { AcademicYearScreen } from "@/features/admin/core/screens/academic-year/AcademicYearScreen";

export const metadata: Metadata = { title: "Academic Year" };

export default function Page() {
  return <AcademicYearScreen />;
}
