import { create } from "zustand";
import {
  CurrentGameMatchResponse,
  getCurrentGameMatch,
  getCurrentGamePlayer,
  getParty,
  getPartyPlayer,
  getPreGameMatch,
  getPreGamePlayer,
  PartyResponse,
  getPlayerNames,
} from "~/utils/valorant-api";

export type CombatSessionSnapshot = {
  state: "idle" | "pregame" | "live";
  matchId: string | null;
  partyId: string | null;
  pregameMatch: any | null; // LockCharacterResponse
  currentGameMatch: CurrentGameMatchResponse | null;
  party: PartyResponse | null;
  namesBySubject: Record<string, string>;
};

const EMPTY_SESSION: CombatSessionSnapshot = {
  state: "idle",
  matchId: null,
  partyId: null,
  pregameMatch: null,
  currentGameMatch: null,
  party: null,
  namesBySubject: {},
};

interface CombatState {
  snapshot: CombatSessionSnapshot;
  loading: boolean;
  lastUpdated: number;
  fetchSession: (user: any) => Promise<CombatSessionSnapshot>;
}

export const useCombatStore = create<CombatState>((set, get) => ({
  snapshot: EMPTY_SESSION,
  loading: false,
  lastUpdated: 0,

  fetchSession: async (user) => {
    if (!user.accessToken || !user.entitlementsToken || !user.region || !user.id) {
      set({ snapshot: EMPTY_SESSION, loading: false });
      return EMPTY_SESSION;
    }

    set({ loading: true });

    try {
      const [partyPlayer, pregamePlayer, currentGamePlayer] = await Promise.all([
        getPartyPlayer(user.accessToken, user.entitlementsToken, user.region, user.id),
        getPreGamePlayer(user.accessToken, user.entitlementsToken, user.region, user.id),
        getCurrentGamePlayer(user.accessToken, user.entitlementsToken, user.region, user.id),
      ]);

      const partyId = partyPlayer?.CurrentPartyID || null;
      const [party, pregameMatch, currentGameMatch] = await Promise.all([
        partyId
          ? getParty(user.accessToken, user.entitlementsToken, user.region, partyId)
          : Promise.resolve(null),
        pregamePlayer?.MatchID
          ? getPreGameMatch(user.accessToken, user.entitlementsToken, user.region, pregamePlayer.MatchID)
          : Promise.resolve(null),
        currentGamePlayer?.MatchID
          ? getCurrentGameMatch(user.accessToken, user.entitlementsToken, user.region, currentGamePlayer.MatchID)
          : Promise.resolve(null),
      ]);

      const subjects = Array.from(
        new Set(
          [
            ...(party?.Members || []).map((member) => member.Subject),
            ...(pregameMatch?.AllyTeam?.Players || []).map((player: any) => player.Subject),
            ...(pregameMatch?.EnemyTeam?.Players || []).map((player: any) => player.Subject),
            ...(currentGameMatch?.Players || []).map((player) => player.Subject),
          ]
            .filter((subject): subject is string => Boolean(subject))
            .map((s) => s.toLowerCase())
        )
      );

      const names = subjects.length
        ? await getPlayerNames(user.accessToken, user.entitlementsToken, subjects, user.region)
        : [];

      const namesBySubject = Object.fromEntries(
        names.map((entry) => [
          entry.Subject.toLowerCase(),
          entry.TagLine ? `${entry.GameName}#${entry.TagLine}` : entry.GameName,
        ])
      );

      const nextSnapshot: CombatSessionSnapshot = pregameMatch
        ? {
            state: "pregame",
            matchId: pregamePlayer?.MatchID || pregameMatch.ID || null,
            partyId,
            pregameMatch,
            currentGameMatch: null,
            party,
            namesBySubject,
          }
        : currentGameMatch
          ? {
              state: "live",
              matchId: currentGamePlayer?.MatchID || currentGameMatch.MatchID || null,
              partyId,
              pregameMatch: null,
              currentGameMatch,
              party,
              namesBySubject,
            }
          : {
              ...EMPTY_SESSION,
              partyId,
              party,
              namesBySubject,
            };

      set({ snapshot: nextSnapshot, loading: false, lastUpdated: Date.now() });
      return nextSnapshot;
    } catch (error) {
      console.warn("[useCombatStore] Failed to fetch session", error);
      set({ snapshot: EMPTY_SESSION, loading: false });
      return EMPTY_SESSION;
    }
  },
}));
