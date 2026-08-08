import type { Metadata } from "next";
import { CalendarScreen } from "@/features/admin/core/screens/calendar/CalendarScreen";

export const metadata: Metadata = { title: "Academic Calendar" };

export default function Page() {
  return <CalendarScreen />;
}
