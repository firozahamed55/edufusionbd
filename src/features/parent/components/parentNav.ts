import { Home, CalendarCheck2, GraduationCap, Wallet, type LucideIcon } from "lucide-react";

export type ParentNavItem = {
  key: string;
  href: string;
  icon: LucideIcon;
  bn: string;
  en: string;
};

/** Bottom tab bar — the 4 primary parent destinations (Figma). */
export const PARENT_NAV: ParentNavItem[] = [
  { key: "home", href: "/parent", icon: Home, bn: "হোম", en: "Home" },
  { key: "attendance", href: "/parent/attendance", icon: CalendarCheck2, bn: "উপস্থিতি", en: "Attendance" },
  { key: "results", href: "/parent/results", icon: GraduationCap, bn: "ফলাফল", en: "Results" },
  { key: "fees", href: "/parent/fees", icon: Wallet, bn: "ফি", en: "Fees" },
];
