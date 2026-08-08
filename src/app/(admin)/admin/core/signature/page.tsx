import type { Metadata } from "next";
import { SignatureScreen } from "@/features/admin/core/screens/signature/SignatureScreen";

export const metadata: Metadata = { title: "Approved Signatures" };

export default function Page() {
  return <SignatureScreen />;
}
