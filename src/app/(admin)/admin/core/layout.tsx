import { ModuleTabs, ScreenGate } from "@/features/admin/components";

/**
 * Settings module shell.
 *
 * A note on the `metadata` export each page in this folder now carries (audit
 * A-8): all eleven Settings screens shared one browser-tab title, so a
 * screen-reader user with several tabs open could not tell them apart, and
 * neither could anyone else — WCAG 2.4.2 Page Titled. The root layout supplies
 * the `%s · EduFusionBD` template; each page supplies the `%s`.
 *
 * Those titles are English only, deliberately. `metadata` is evaluated on the
 * server, where `useT` does not exist and the locale lives in a client store;
 * and a title carrying both languages truncates to uselessness in a tab strip.
 * The visible heading inside each page stays bilingual, as it always was.
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-5">
      <ModuleTabs moduleKey="core" />
      <ScreenGate>{children}</ScreenGate>
    </div>
  );
}
