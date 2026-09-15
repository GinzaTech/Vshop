import React from "react";
import { getCompetitiveMMR, getContent } from "~/utils/valorant-api";
import { sanitizeErrorForLog } from "~/utils/log-redaction";
import { hasRiotScreenSession, isCurrentRiotScreenSession, type RiotScreenSession } from "~/hooks/useRiotScreenSession";
import {
  buildPlayerIntel, EMPTY_INTEL, EMPTY_COMPETITIVE_PERFORMANCE, fetchCompetitivePerformanceBatch,
  type PlayerIntel, type CompetitivePerformance,
} from "~/features/combat/session-insights";
import { useCombatPoll } from "~/features/combat/useCombatPoll";
import type { useCombatScreenActivity } from "~/features/combat/useCombatScreenActivity";

type IntelData = { playerIntel: Record<string, PlayerIntel>; competitivePerformance: Record<string, CompetitivePerformance> };
type ScopedIntelData = IntelData & { session: RiotScreenSession; matchId: string | null };

function preserveReady<T extends { status: string }>(next: T, previous?: T): T {
  return next.status === "ready" || previous?.status !== "ready" ? next : previous;
}

export function useCombatPlayerIntel(session: RiotScreenSession, subjectKey: string, matchId: string | null, activity: ReturnType<typeof useCombatScreenActivity>) {
  const [state, setState] = React.useState<ScopedIntelData>({ session, matchId, playerIntel: {}, competitivePerformance: {} });
  const subjects = React.useMemo(() => subjectKey ? subjectKey.split("|") : [], [subjectKey]);
  const { isActive, isActiveNow } = activity;
  const isCurrent = React.useCallback(() => isActiveNow() && isCurrentRiotScreenSession(session), [isActiveNow, session]);
  const scopeState = React.useCallback((current: ScopedIntelData): ScopedIntelData =>
    current.session === session && current.matchId === matchId ? current
      : { session, matchId, playerIntel: {}, competitivePerformance: {} }, [matchId, session]);
  const enabled = isActive && hasRiotScreenSession(session) && subjects.length > 0;

  const fetchRanks = React.useCallback(async (requestIsCurrent: () => boolean) => {
    const content = await getContent(session.accessToken, session.entitlementsToken, session.region).catch((error: unknown) => {
      if (requestIsCurrent() && __DEV__) console.warn("[combat] Content unavailable", sanitizeErrorForLog(error));
      return null;
    });
    if (!requestIsCurrent()) return null;
    return Promise.allSettled(subjects.map(async (subject) => {
      const mmr = await getCompetitiveMMR(session.accessToken, session.entitlementsToken, session.region, subject);
      return buildPlayerIntel(mmr, content?.Seasons ?? []);
    }));
  }, [session, subjects]);
  const applyRanks = React.useCallback((results: Awaited<ReturnType<typeof fetchRanks>>) => {
    if (!results) return;
    setState((previous) => {
      const current = scopeState(previous);
      return { ...current, playerIntel: Object.fromEntries(subjects.map((subject, index) => {
        const result = results[index];
        return [subject, preserveReady<PlayerIntel>(
          result.status === "fulfilled" ? result.value : { ...EMPTY_INTEL, status: "private" }, current.playerIntel[subject]
        )];
      })) };
    });
  }, [scopeState, subjects]);
  useCombatPoll({ enabled, repeat: false, request: fetchRanks, onResult: applyRanks, isCurrent });

  const fetchPerformance = React.useCallback(() => fetchCompetitivePerformanceBatch(session, subjects), [session, subjects]);
  const applyPerformance = React.useCallback((data: Record<string, CompetitivePerformance>) => {
    setState((previous) => {
      const current = scopeState(previous);
      return { ...current, competitivePerformance: Object.fromEntries(subjects.map((subject) => [subject,
        preserveReady<CompetitivePerformance>(data[subject] ?? { ...EMPTY_COMPETITIVE_PERFORMANCE, status: "private" }, current.competitivePerformance[subject]),
      ])) };
    });
  }, [scopeState, subjects]);
  const performanceFailed = React.useCallback(() => {
    setState((previous) => {
      const current = scopeState(previous);
      return { ...current, competitivePerformance: Object.fromEntries(subjects.map((subject) => [subject,
        preserveReady<CompetitivePerformance>({ ...EMPTY_COMPETITIVE_PERFORMANCE, status: "private" }, current.competitivePerformance[subject]),
      ])) };
    });
  }, [scopeState, subjects]);
  useCombatPoll({ enabled, repeat: false, request: fetchPerformance, onResult: applyPerformance, onError: performanceFailed, isCurrent });

  if (state.session !== session || state.matchId !== matchId || !hasRiotScreenSession(session) || !subjects.length) {
    return { playerIntel: {}, competitivePerformance: {} };
  }
  return {
    playerIntel: Object.fromEntries(subjects.map((subject) => [subject, state.playerIntel[subject] ?? EMPTY_INTEL])),
    competitivePerformance: Object.fromEntries(subjects.map((subject) => [subject, state.competitivePerformance[subject] ?? EMPTY_COMPETITIVE_PERFORMANCE])),
  };
}
