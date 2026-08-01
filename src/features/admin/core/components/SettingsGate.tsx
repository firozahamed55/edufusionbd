"use client";

import type { ReactNode } from "react";
import { useT } from "@/shared/i18n/useT";
import { NoAccessState, buttonClass } from "@/shared/ui";
import { holdsPermission } from "@/features/admin/components/adminNav";
import { useMyPermissions } from "../logic/hooks";

/**
 * "Not for you", said once, in front of every Settings screen (audit M-4).
 *
 * WHY A WRAPPER AND NOT ELEVEN EDITS. The finding asks for `<NoAccessState>` on
 * all eleven screens. Rendering it from the route rather than from inside each
 * screen gets the same outcome and one better property: the screen never
 * mounts, so a caller without `core.user_manage` does not fire the user-list
 * query, collect the 42501, and render a refusal on top of a failed request.
 * The refusal is the first thing that happens, not the last.
 *
 * WHY IT STILL IS NOT THE CONTROL. `useMyPermissions` is a client query and
 * this is a client component; anyone can lie to it. The controls are RLS and
 * the `require_permission` guard at the top of every Settings RPC, and neither
 * is relaxed because this exists. This gate exists so the product can *say*
 * what those controls already *do*.
 *
 * FAIL-OPEN, matching `canSeeModule` and `canSeeTab`. While permissions load
 * (`undefined`) and for an account whose `user_role` rows were never seeded
 * (`[]`), the screen renders. A lock icon shown to an administrator because a
 * query had not resolved yet is a worse failure than a moment of visible
 * access that RLS then declines to serve.
 */
export function SettingsGate({
  permission,
  children,
}: {
  permission: string;
  children: ReactNode;
}) {
  const { t } = useT();
  const permissions = useMyPermissions();

  if (holdsPermission(permission, permissions.data)) return <>{children}</>;

  /**
   * The recipient is deliberately empty. The product does not know who
   * administers this institution — there is no support-contact setting, and
   * inventing one would put a wrong address in front of the operator. An empty
   * `To:` opens their mail client with the ask already written, which is the
   * part they would otherwise have to compose themselves.
   */
  const mailto = `mailto:?subject=${encodeURIComponent(
    t("অনুমতির অনুরোধ", "Access request"),
  )}&body=${encodeURIComponent(
    t(
      `EduFusion-এ আমার এই অনুমতিটি প্রয়োজন: ${permission}\n\nকারণ:`,
      `Please grant me this EduFusion permission: ${permission}\n\nReason:`,
    ),
  )}`;

  return (
    <NoAccessState
      title={t("এই পাতা দেখার অনুমতি নেই", "You do not have access to this page")}
      description={t(
        "এই স্ক্রিনটি খুলতে নিচের অনুমতিটি প্রয়োজন। প্রতিষ্ঠানের অ্যাডমিনকে অনুরোধ করুন।",
        "This screen needs the permission below. Ask your institution's administrator for it.",
      )}
      permission={permission}
      action={
        <a href={mailto} className={buttonClass("secondary")}>
          {t("অনুমতির অনুরোধ করুন", "Request access")}
        </a>
      }
    />
  );
}
