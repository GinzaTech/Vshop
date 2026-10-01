import React from "react";
import { matchDetails } from "~/utils/valorant-api";
import { hasRiotScreenSession, isCurrentRiotScreenSession, type RiotScreenSession } from "~/hooks/useRiotScreenSession";
import { buildMatchPerformanceBySubject, EMPTY_MATCH_PERFORMANCE, type MatchPerformance } from "~/features/combat/session-insights";
import { useCombatPoll } from "~/features/combat/useCombatPoll";
import type { useCombatScreenActivity } from "~/features/combat/useCombatScreenActivity";
import { extractMatchScore, type MatchScore } from "~/features/combat/match-score";
import { getSessionGeneration } from "~/utils/session-operations";

/** One guarded match-details wave supplies both roster stats and the score. */
export function useCombatMatchData(session: RiotScreenSession, subjectKey: string, matchId: string | undefined, enabled: boolean, activity: ReturnType<typeof useCombatScreenActivity>, selfTeamId?: string) {
  const subjects = React.useMemo(() => subjectKey ? subjectKey.split("|") : [], [subjectKey]);
  const empty = React.useMemo(() => Object.fromEntries(subjects.map((subject) => [subject, EMPTY_MATCH_PERFORMANCE])), [subjects]);
  const generation = getSessionGeneration();
  const [state, setState] = React.useState<{
    session: RiotScreenSession; generation: number; matchId: string | undefined;
    data: Record<string, MatchPerformance>; score: MatchScore | null;
  }>({ session, generation, matchId, data: {}, score: null });
  const { isActive, isActiveNow } = activity;
  const isCurrent = React.useCallback(() => isActiveNow() && generation === getSessionGeneration() && isCurrentRiotScreenSession(session), [generation, isActiveNow, session]);
  const request = React.useCallback(async () => matchDetails(session.accessToken, session.entitlementsToken, session.region, matchId!), [matchId, session]);
  const onResult = React.useCallback((details: Awaited<ReturnType<typeof matchDetails>> | null) => {
    const validDetails = details?.matchInfo?.matchId === matchId ? details : null;
    const data = validDetails ? buildMatchPerformanceBySubject(validDetails, subjects) : null;
    const score = extractMatchScore(validDetails, matchId, selfTeamId);
    // Null/error/mismatched data retains only this account/generation/match's good values.
    setState((current) => {
      const sameMatch = current.session === session && current.generation === generation && current.matchId === matchId;
      return {
        session, generation, matchId,
        data: data ?? (sameMatch ? { ...empty, ...current.data } : empty),
        score: score ?? (sameMatch && current.score?.selfTeamId === selfTeamId ? current.score : null),
      };
    });
  }, [empty, generation, matchId, selfTeamId, session, subjects]);
  const onError = React.useCallback(() => { onResult(null); }, [onResult]);
  useCombatPoll({
    enabled: enabled && isActive && Boolean(matchId) && hasRiotScreenSession(session),
    repeat: true, intervalMs: 3000, request, onResult, onError, isCurrent,
  });
  if (!matchId || !hasRiotScreenSession(session)) return { performance: empty, score: null };
  const sameMatch = state.session === session && state.generation === generation && state.matchId === matchId;
  const performance = Object.fromEntries(subjects.map((subject) => [subject,
    sameMatch && state.data[subject]
      ? state.data[subject]
      : enabled ? { ...EMPTY_MATCH_PERFORMANCE, status: "loading" as const } : EMPTY_MATCH_PERFORMANCE,
  ]));
  return { performance, score: enabled && sameMatch && state.score?.selfTeamId === selfTeamId ? state.score : null };
}

/** Compatibility facade for consumers that only need player performance. */
export function useCombatMatchPerformance(session: RiotScreenSession, subjectKey: string, matchId: string | undefined, enabled: boolean, activity: ReturnType<typeof useCombatScreenActivity>) {
  return useCombatMatchData(session, subjectKey, matchId, enabled && Boolean(subjectKey), activity).performance;
}
