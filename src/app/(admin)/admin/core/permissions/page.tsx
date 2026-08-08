import type { Metadata } from "next";
import { PermissionMatrixScreen } from "@/features/admin/core/screens/permissions/PermissionMatrixScreen";

export const metadata: Metadata = { title: "Permission Matrix" };

export default function Page() {
  return <PermissionMatrixScreen />;
}
