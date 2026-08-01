import type { Metadata } from "next";
import { PermissionMatrixScreen } from "@/features/admin/core/screens/permissions/PermissionMatrixScreen";
import { SettingsGate } from "@/features/admin/core/components/SettingsGate";

/**
 * A-8 — all eleven Settings screens shared one browser-tab title, so a
 * screen-reader user with several open could not tell them apart (WCAG 2.4.2
 * Page Titled). The root layout's `template` appends "· EduFusionBD".
 *
 * English only, and deliberately: `metadata` is resolved on the server before
 * the locale provider exists, and `useT` is a hook. A bilingual tab title needs
 * `generateMetadata` reading the locale cookie, which is worth doing across the
 * whole app at once rather than for eleven routes in an accessibility pass.
 */
export const metadata: Metadata = { title: "Permission Matrix" };

export default function Page() {
  return (
    <SettingsGate permission="core.user_manage">
      <PermissionMatrixScreen />
    </SettingsGate>
  );
}
