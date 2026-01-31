import { create } from "zustand";
import { playerMatchHistory, matchDetails } from "~/utils/valorant-api";
import { getAssets, getAgent } from "~/utils/valorant-assets";
import { defaultUser } from "~/utils/valorant-api"; // Assuming we can get user info or pass it

interface MatchStats {
    kda: string;
    kills: number;
    deaths: number;
    assists: number;
    score: number;
    won: boolean;
    roundsWon: number;
    roundsLost: number;
    agentIcon: string;
    mapName: string;
    mapImage: string;
    gameMode: string;
}

interface Match {
    MatchID: string;
    GameStartTime: number;
    QueueID: string;
    stats?: MatchStats;
}

interface MatchState {
    matches: Match[];
    loading: boolean;
    lastUpdated: number;
    fetchMatches: (user: typeof defaultUser) => Promise<void>;
}

export const useMatchStore = create<MatchState>((set, get) => ({
    matches: [],
    loading: false,
    lastUpdated: 0,
    fetchMatches: async (user) => {
        // Prevent frequent refetching (e.g., 5 minutes cache)
        if (Date.now() - get().lastUpdated < 5 * 60 * 1000 && get().matches.length > 0) {
            return;
        }

        if (!user.accessToken || !user.entitlementsToken || !user.id || !user.region) return;

        set({ loading: true });
        try {
            const historyData = await playerMatchHistory(
                user.accessToken,
                user.entitlementsToken,
                user.region,
                user.id,
                { startIndex: 0, endIndex: 10 }
            );

            const historyList = historyData.History || [];
            const detailedMatches: Match[] = [];
            const assets = getAssets();
            const agents = getAgent().agents;

            // Optimistic update or sequential fetch? 
            // We'll do parallel fetch for speed, but limit concurrency if needed.
            // For now, sequential is safer for rate limits, but slow.
            // Let's try `Promise.all` with a small batch or just all 5-10.

            const detailPromises = historyList.map(async (match: any) => {
                try {
                    const details = await matchDetails(
                        user.accessToken,
                        user.entitlementsToken,
                        user.region,
                        match.MatchID
                    );

                    if (!details || !details.players || !details.teams) return { ...match, stats: null };

                    const myself = details.players.find((p: any) => p.subject === user.id);
                    if (!myself) return { ...match, stats: null };

                    const teamId = myself.teamId;
                    const myTeam = details.teams.find((t: any) => t.teamId === teamId);

                    const mapInfo = assets.maps ? assets.maps.find((m: any) => m.mapUrl === details.matchInfo?.mapId) : null;
                    const agentInfo = agents ? agents.find((a: any) => a.uuid === myself.characterId) : null;

                    return {
                        ...match,
                        stats: {
                            kda: `${myself.stats.score}/${myself.stats.roundsPlayed}/${myself.stats.kills}`,
                            kills: myself.stats.kills,
                            deaths: myself.stats.deaths,
                            assists: myself.stats.assists,
                            score: myself.stats.score,
                            won: myTeam ? myTeam.won : false,
                            roundsWon: myTeam ? myTeam.roundsWon : 0,
                            roundsLost: myTeam ? (myTeam.roundsPlayed - myTeam.roundsWon) : 0,
                            agentIcon: agentInfo?.displayIcon,
                            mapName: mapInfo?.displayName || details.matchInfo.mapId,
                            mapImage: mapInfo?.listViewIcon || mapInfo?.splash,
                            gameMode: details.matchInfo.gameMode,
                        }
                    };
                } catch (e) {
                    console.warn(`Failed to fetch details for ${match.MatchID}`, e);
                    return { ...match, stats: null };
                }
            });

            const results = await Promise.all(detailPromises);
            set({ matches: results, loading: false, lastUpdated: Date.now() });

        } catch (error) {
            console.error("Failed to fetch matches globally", error);
            set({ loading: false });
        }
    }
}));
