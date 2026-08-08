"use client";

import { usePathname } from "next/navigation";
import { useT } from "@/shared/i18n/useT";
import { NoAccessState } from "@/shared/ui";
import { useMyPermissions } from "../core/logic/hooks";
import { permissionForPath } from "./adminNav";

/**
 * Route-level "not for you", as distinct from "nothing here" (settings audit
 * M-4, H-1).
 *
 * Hiding the tab (`ModuleTabs`) is not enough on its own: `/admin/*` is open to
 * `admin | teacher | super_admin` at the middleware, so a teacher can type
 * `/admin/core/user-list` and reach a screen whose every query returns nothing.
 * RLS is doing its job there — the screen is the thing that lies, by rendering
 * that refusal as an empty table.
 *
 * Dropped into a module LAYOUT rather than into each screen: the permission a
 * route needs is already declared in `adminNav`, so resolving it from the
 * pathname is one gate for all eleven Settings screens instead of eleven
 * copies of the same three lines that the twelfth screen will forget.
 *
 * Fails open on `undefined`/`[]` for the same reason `canSeeModule` does — a
 * lock screen during the permissions fetch, or for an account whose
 * `user_role` rows were never seeded, reads as a broken product.
 */
export function ScreenGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useT();
  const { data: permissions } = useMyPermissions();

  const needed = permissionForPath(pathname);
  const allowed =
    !needed || !permissions || permissions.length === 0 || permissions.includes(needed);

  if (allowed) return <>{children}</>;

  return (
    <NoAccessState
      title={t("এই পাতা দেখার অনুমতি নেই", "You do not have access to this page")}
      description={t(
        "এই স্ক্রিনটি ব্যবহার করতে অতিরিক্ত অনুমতি প্রয়োজন। প্রতিষ্ঠানের অ্যাডমিনকে জানান।",
        "This screen needs a permission your account does not hold. Ask your institution's administrator.",
      )}
      permission={needed}
    />
  );
}
