import type { Metadata } from "next";
import { AuditLogScreen } from "@/features/admin/core/screens/audit-log/AuditLogScreen";

export const metadata: Metadata = { title: "Audit Log" };

export default function Page() {
  return <AuditLogScreen />;
}
