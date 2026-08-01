"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import { Modal, Button } from "@/shared/ui";
import { createClient } from "@/shared/services/supabase/client";
import { recordSecurityEvent } from "@/shared/services/security/api";

/** Minutes of inactivity before the warning, and before the sign-out. */
const WARN_AFTER_MIN = 25;
const SIGN_OUT_AFTER_MIN = 30;

const ACTIVITY = ["mousedown", "keydown", "scroll", "touchstart", "visibilitychange"] as const;

/**
 * Idle timeout (SRA B-3).
 *
 * "A session on a shared school computer persists indefinitely." That machine
 * sits in an open office and is used by whoever needs it next; the previous
 * operator's session is still signed in with fee collection and student
 * records one click away.
 *
 * Warns at 25 minutes with an explicit extension, signs out at 30. The
 * countdown is shown rather than a bare "you will be signed out", because a
 * teacher mid-way through marks entry needs to know whether they have time to
 * finish the row.
 *
 * WHY A TIMER AND NOT A SHORTER JWT. Shortening the token lifetime signs out
 * an *active* user just as readily as an idle one; the thing that is unsafe is
 * the unattended machine, and only activity distinguishes them. Autosave (A-0.6)
 * is the complement: this can fire during a long marks-entry session, and the
 * draft has to survive it.
 */
export function IdleTimeout() {
  const { t, n } = useT();
  const router = useRouter();
  const [warning, setWarning] = useState(false);
  const [remaining, setRemaining] = useState((SIGN_OUT_AFTER_MIN - WARN_AFTER_MIN) * 60);
  const lastActive = useRef(Date.now());

  const signOut = useCallback(async () => {
    const supabase = createClient();
    await recordSecurityEvent(supabase, "auth.sign_out").catch(() => {});
    await supabase.auth.signOut();
    router.replace("/login?reason=idle");
    router.refresh();
  }, [router]);

  const stayIn = useCallback(() => {
    lastActive.current = Date.now();
    setWarning(false);
  }, []);

  useEffect(() => {
    const bump = () => {
      // While the warning is up, ordinary activity must NOT silently dismiss
      // it: the person at the keyboard may not be the person who signed in.
      // Only the explicit button counts.
      if (!warning) lastActive.current = Date.now();
    };
    for (const evt of ACTIVITY) window.addEventListener(evt, bump, { passive: true });

    const tick = window.setInterval(() => {
      const idleMs = Date.now() - lastActive.current;
      const warnMs = WARN_AFTER_MIN * 60_000;
      const outMs = SIGN_OUT_AFTER_MIN * 60_000;

      if (idleMs >= outMs) {
        void signOut();
      } else if (idleMs >= warnMs) {
        setWarning(true);
        setRemaining(Math.ceil((outMs - idleMs) / 1000));
      }
    }, 1000);

    return () => {
      for (const evt of ACTIVITY) window.removeEventListener(evt, bump);
      window.clearInterval(tick);
    };
  }, [warning, signOut]);

  const mm = Math.floor(remaining / 60);
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <Modal
      open={warning}
      onClose={stayIn}
      title={t("এখনও আছেন?", "Still there?")}
      description={t(
        "নিষ্ক্রিয়তার কারণে আপনাকে শীঘ্রই লগআউট করা হবে। শেয়ার্ড কম্পিউটারে এটি সুরক্ষার জন্য।",
        "You will be signed out shortly due to inactivity. This protects shared computers.",
      )}
      className="max-w-sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => void signOut()}>
            {t("এখনই লগআউট", "Sign out now")}
          </Button>
          <Button variant="primary" onClick={stayIn}>
            {t("লগইন রাখুন", "Stay signed in")}
          </Button>
        </>
      }
    >
      <div className="flex items-center justify-center gap-3 rounded-xl bg-sunken px-4 py-5">
        <Clock size={20} className="text-text-muted" aria-hidden />
        {/* aria-live so a screen-reader user is told, not just shown. */}
        <p className="text-h4 font-bold tabular-nums text-text-primary" aria-live="polite">
          {n(mm)}:{n(ss)}
        </p>
      </div>
    </Modal>
  );
}
