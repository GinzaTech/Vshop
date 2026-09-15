import React from "react";

import { useUserStore } from "~/hooks/useUserStore";
import { hasRiotScreenSession, isCurrentRiotScreenSession, useRiotScreenSession, type RiotScreenSession } from "~/hooks/useRiotScreenSession";
import { sanitizeErrorForLog } from "~/utils/log-redaction";
import { getSessionGeneration } from "~/utils/session-operations";

export type AccountScreenSession = RiotScreenSession;

export type AccountScreenLoadResult<Data> = {
  data: Partial<Data>;
  errors: unknown[];
};

/** Shared request ownership for the About and Contracts account data. */
export function useAccountScreenData<Data>(
  load: (session: AccountScreenSession) => Promise<AccountScreenLoadResult<Data>>,
  emptyData: Data,
  logLabel: string,
) {
  const user = useUserStore((state) => state.user);
  const session = useRiotScreenSession(user);
  const hasSession = hasRiotScreenSession(session);
  const activeSession = React.useRef<AccountScreenSession | null>(null);
  const requestId = React.useRef(0);
  const [state, setState] = React.useState({ session, data: emptyData, loading: hasSession });

  const reload = React.useCallback(async () => {
    if (activeSession.current !== session || !hasSession || !isCurrentRiotScreenSession(session)) return;
    const currentRequest = ++requestId.current;
    const generation = getSessionGeneration();
    const isCurrent = () => generation === getSessionGeneration() && activeSession.current === session && currentRequest === requestId.current && isCurrentRiotScreenSession(session);
    try {
      const result = await load(session);
      if (!isCurrent()) return;
      if (__DEV__) {
        result.errors.forEach((error) => console.error(logLabel, sanitizeErrorForLog(error)));
      }
      setState((previous) => isCurrent() ? {
        session,
        data: { ...(previous.session === session ? previous.data : emptyData), ...result.data },
        loading: false,
      } : previous);
    } catch (error) {
      if (!isCurrent()) return;
      if (__DEV__) console.error(logLabel, sanitizeErrorForLog(error));
      setState((previous) => isCurrent() ? { ...previous, loading: false } : previous);
    }
  }, [emptyData, hasSession, load, logLabel, session]);

  React.useEffect(() => {
    activeSession.current = session;
    setState({ session, data: emptyData, loading: hasSession });
    void reload();
    return () => {
      activeSession.current = null;
      requestId.current += 1;
    };
  }, [emptyData, hasSession, reload, session]);

  const updateData = React.useCallback((update: (data: Data) => Data) => {
    if (activeSession.current !== session || !isCurrentRiotScreenSession(session)) return;
    setState((previous) => previous.session === session && isCurrentRiotScreenSession(session)
      ? { ...previous, data: update(previous.data) }
      : previous);
  }, [session]);

  // Hide the previous account during render, before effect cleanup/load runs.
  return {
    data: state.session === session ? state.data : emptyData,
    loading: state.session === session ? state.loading : hasSession,
    reload,
    updateData,
    session,
  };
}
