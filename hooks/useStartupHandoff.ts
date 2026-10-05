import { useCallback, useState } from "react";

type StartupDestination = Readonly<{ pathname: string; metricRoute: string }>;

/** Navigation intent is not readiness: wait until the destination is committed. */
export function useStartupHandoff(pathname: string) {
  const [destination, setDestination] = useState<StartupDestination | null>(null);
  const requestHandoff = useCallback((targetPathname: string, metricRoute: string) => {
    setDestination({ pathname: targetPathname, metricRoute });
  }, []);
  return { destination, requestHandoff, committed: destination !== null && destination.pathname === pathname };
}
