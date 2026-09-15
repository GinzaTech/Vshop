import React from "react";
import { useUserStore } from "~/hooks/useUserStore";
import { useCombatStore } from "~/hooks/useCombatStore";
import { hasRiotScreenSession, isCurrentRiotScreenSession, type RiotScreenSession } from "~/hooks/useRiotScreenSession";
import { useCombatPoll } from "~/features/combat/useCombatPoll";
import type { useCombatScreenActivity } from "~/features/combat/useCombatScreenActivity";

export function useCombatSessionPolling(session: RiotScreenSession, live: boolean, activity: ReturnType<typeof useCombatScreenActivity>) {
  const fetchSession = useCombatStore((state) => state.fetchSession);
  const pending = React.useRef<Promise<unknown> | null>(null);
  const { isActive, isActiveNow } = activity;
  const isCurrent = React.useCallback(() => isActiveNow() && isCurrentRiotScreenSession(session), [isActiveNow, session]);
  const refresh = React.useCallback(async () => {
    if (!isCurrent() || !hasRiotScreenSession(session)) return;
    if (pending.current) return pending.current;
    const task = fetchSession(useUserStore.getState().user);
    pending.current = task;
    try { return await task; }
    finally { if (pending.current === task) pending.current = null; }
  }, [fetchSession, isCurrent, session]);
  useCombatPoll({ enabled: isActive && hasRiotScreenSession(session), repeat: live, request: refresh, isCurrent });
  return refresh;
}
