import React from "react";
import { matchDetails } from "~/utils/valorant-api";
import { hasRiotScreenSession, isCurrentRiotScreenSession, type RiotScreenSession } from "~/hooks/useRiotScreenSession";
import { buildMatchPerformanceBySubject, EMPTY_MATCH_PERFORMANCE, type MatchPerformance } from "~/features/combat/session-insights";
import { useCombatPoll } from "~/features/combat/useCombatPoll";
import type { useCombatScreenActivity } from "~/features/combat/useCombatScreenActivity";

export function useCombatMatchPerformance(session: RiotScreenSession, subjectKey: string, matchId: string | undefined, enabled: boolean, activity: ReturnType<typeof useCombatScreenActivity>) {
  const subjects = React.useMemo(() => subjectKey ? subjectKey.split("|") : [], [subjectKey]);
  const empty = React.useMemo(() => Object.fromEntries(subjects.map((subject) => [subject, EMPTY_MATCH_PERFORMANCE])), [subjects]);
  const [state, setState] = React.useState<{ session: RiotScreenSession; matchId: string | undefined; data: Record<string, MatchPerformance> }>({ session, matchId, data: {} });
  const { isActive, isActiveNow } = activity;
  const isCurrent = React.useCallback(() => isActiveNow() && isCurrentRiotScreenSession(session), [isActiveNow, session]);
  const request = React.useCallback(async () => matchDetails(session.accessToken, session.entitlementsToken, session.region, matchId!), [matchId, session]);
  const onResult = React.useCallback((details: Awaited<ReturnType<typeof matchDetails>> | null) => {
    // A transient failure preserves ready values from this account and match.
    if (details) setState({ session, matchId, data: buildMatchPerformanceBySubject(details, subjects) });
    else setState((current) => current.session === session && current.matchId === matchId
      ? { ...current, data: { ...empty, ...current.data } }
      : { session, matchId, data: empty });
  }, [empty, matchId, session, subjects]);
  const onError = React.useCallback(() => { onResult(null); }, [onResult]);
  useCombatPoll({
    enabled: enabled && isActive && Boolean(matchId) && subjects.length > 0 && hasRiotScreenSession(session),
    repeat: true, request, onResult, onError, isCurrent,
  });
  if (!matchId || !hasRiotScreenSession(session)) return empty;
  return Object.fromEntries(subjects.map((subject) => [subject,
    state.session === session && state.matchId === matchId && state.data[subject]
      ? state.data[subject]
      : enabled ? { ...EMPTY_MATCH_PERFORMANCE, status: "loading" as const } : EMPTY_MATCH_PERFORMANCE,
  ]));
}
