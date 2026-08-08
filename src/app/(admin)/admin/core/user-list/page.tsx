import type { Metadata } from "next";
import { UserListScreen } from "@/features/admin/core/screens/user-list/UserListScreen";

export const metadata: Metadata = { title: "Users & Roles" };

export default function Page() {
  return <UserListScreen />;
}
