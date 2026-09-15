import React from "react";
import { getContent, getLeaderboard } from "~/utils/valorant-api";
import { buildLeaderboardSeasonOptions, type LeaderboardSeasonOption } from "~/utils/leaderboard-seasons";
import { sanitizeErrorForLog } from "~/utils/log-redaction";
import { getSessionGeneration } from "~/utils/session-operations";
import { useAsyncRefresh } from "~/hooks/useAsyncRefresh";
import { hasRiotScreenSession, isCurrentRiotScreenSession, useRiotScreenSession, type RiotScreenSession } from "~/hooks/useRiotScreenSession";

type LeaderboardState = {
  session: RiotScreenSession;
  players: LeaderboardResponse["Players"];
  totalPlayers: number;
  seasons: LeaderboardSeasonOption[];
  selectedSeason: string | null;
  loading: boolean;
};

const emptyState = (session: RiotScreenSession): LeaderboardState => ({
  session, players: [], totalPlayers: 0, seasons: [], selectedSeason: null,
  loading: hasRiotScreenSession(session),
});

export function useLeaderboardData(user: RiotScreenSession) {
  const session = useRiotScreenSession(user);
  const [state, setState] = React.useState(() => emptyState(session));
  const boardRequest = React.useRef(0);
  const contentRequest = React.useRef(0);
  const activeSession = React.useRef<RiotScreenSession | null>(null);

  const fetchBoard = React.useCallback(async (seasonId: string, showLoading = true) => {
    const requestId = ++boardRequest.current;
    const generation = getSessionGeneration();
    const isCurrent = () => generation === getSessionGeneration() && activeSession.current === session && requestId === boardRequest.current && isCurrentRiotScreenSession(session);
    if (!hasRiotScreenSession(session) || !isCurrent()) return;
    if (showLoading) setState((current) => ({ ...current, loading: true }));
    try {
      const data = await getLeaderboard(session.accessToken, session.entitlementsToken, session.region, seasonId, { startIndex: 0, size: 100 });
      if (isCurrent() && data) {
        setState((current) => ({ ...current, players: data.Players ?? [], totalPlayers: data.totalPlayers ?? 0 }));
      }
    } catch (error) {
      if (isCurrent() && __DEV__) console.error("Failed to fetch leaderboard:", sanitizeErrorForLog(error));
    } finally {
      if (isCurrent()) setState((current) => ({ ...current, loading: false }));
    }
  }, [session]);

  const initialize = React.useCallback(async () => {
    const requestId = ++contentRequest.current;
    const generation = getSessionGeneration();
    const isCurrent = () => generation === getSessionGeneration() && activeSession.current === session && requestId === contentRequest.current && isCurrentRiotScreenSession(session);
    if (!hasRiotScreenSession(session) || !isCurrent()) return;
    try {
      const content = await getContent(session.accessToken, session.entitlementsToken, session.region);
      if (!isCurrent()) return;
      const seasons = buildLeaderboardSeasonOptions(content?.Seasons ?? []);
      const selectedSeason = (seasons.find((season) => season.isActive) ?? seasons[0])?.id ?? null;
      setState((current) => ({ ...current, seasons, selectedSeason, loading: Boolean(selectedSeason) }));
      if (selectedSeason) await fetchBoard(selectedSeason);
    } catch (error) {
      if (!isCurrent()) return;
      if (__DEV__) console.error("Failed to fetch content:", sanitizeErrorForLog(error));
      setState((current) => ({ ...current, loading: false }));
    }
  }, [fetchBoard, session]);

  React.useEffect(() => {
    activeSession.current = session;
    setState(emptyState(session));
    void initialize();
    return () => {
      activeSession.current = null;
      contentRequest.current += 1;
      boardRequest.current += 1;
    };
  }, [initialize, session]);

  // Mask previous-session rows during the render before the reset effect runs.
  const data = state.session === session ? state : emptyState(session);
  const selectSeason = React.useCallback((seasonId: string) => {
    if (activeSession.current !== session || !isCurrentRiotScreenSession(session)) return;
    setState((current) => ({ ...current, selectedSeason: seasonId }));
    void fetchBoard(seasonId);
  }, [fetchBoard, session]);
  const refresh = React.useCallback(async () => {
    if (data.selectedSeason) await fetchBoard(data.selectedSeason, false);
    else await initialize();
  }, [data.selectedSeason, fetchBoard, initialize]);
  const { refreshing, onRefresh } = useAsyncRefresh(refresh, session);
  return { ...data, selectSeason, refreshing, onRefresh };
}
