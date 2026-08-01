"use client";

import { useEffect, useState } from "react";

/**
 * Whether the browser believes it is online.
 *
 * Extracted from `OfflineBanner` so the auth screens can use the same signal
 * without the banner's layout (SRA B-7 lists an offline state as missing on
 * all seven of them). Bangladeshi school connectivity is intermittent, and a
 * sign-in form that spins forever is the worst version of that.
 *
 * Starts `true` and corrects on mount: `navigator` does not exist during the
 * server render, and defaulting to "offline" would flash a warning at every
 * user on every load.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  return online;
}
