import { useEffect, useState } from "react";

const STARTUP_RECOVERY_WATCHDOG_MS = 8_000;

export function useStartupRecoveryWatchdog(active: boolean) {
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!active) {
      setExpired(false);
      return;
    }

    const timer = setTimeout(() => setExpired(true), STARTUP_RECOVERY_WATCHDOG_MS);
    return () => clearTimeout(timer);
  }, [active]);

  return expired;
}
