import { create } from "zustand";
import { playerMatchHistory, matchDetails } from "~/utils/valorant-api";
import { getAssets, getAgent } from "~/utils/valorant-assets";
import { defaultUser } from "~/utils/valorant-api"; // Assuming we can get user info or pass it
import { preloadImageUrls } from "~/utils/preload";

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
    detailsById: Record<string, any>;
    loading: boolean;
    lastUpdated: number;
    fetchMatches: (user: typeof defaultUser) => Promise<void>;
    fetchMatchDetails: (
        user: typeof defaultUser,
        matchId: string,
        force?: boolean
    ) => Promise<any | null>;
}

export const useMatchStore = create<MatchState>((set, get) => ({
    matches: [],
    detailsById: {},
    loading: false,
    lastUpdated: 0,
    fetchMatchDetails: async (user, matchId, force = false) => {
        if (!user.accessToken || !user.entitlementsToken || !user.region || !matchId) {
            return null;
        }

        const cached = get().detailsById[matchId];
        if (cached && !force) {
            return cached;
        }

        try {
            const details = await matchDetails(
                user.accessToken,
                user.entitlementsToken,
                user.region,
                matchId
            );

            const assets = getAssets();
            const agents = getAgent().agents;
            const mapInfo = assets.maps
                ? assets.maps.find((m: any) => m.mapUrl === details?.matchInfo?.mapId)
                : null;

            const agentIcons = (details?.players || []).map((player: any) => {
                const agentInfo = agents.find((agent: any) => agent.uuid === player.characterId);
                return agentInfo?.displayIcon;
            });

            set((state) => ({
                detailsById: {
                    ...state.detailsById,
                    [matchId]: details,
                },
            }));

            void preloadImageUrls(
                [mapInfo?.listViewIcon, mapInfo?.splash, ...agentIcons],
                { batchSize: 8 }
            );

            return details;
        } catch (error) {
            console.warn(`Failed to fetch cached details for ${matchId}`, error);
            return null;
        }
    },
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
            const assets = getAssets();
            const agents = getAgent().agents;
            const detailsById: Record<string, any> = {};

            const detailPromises = historyList.map(async (match: any) => {
                try {
                    const details = await get().fetchMatchDetails(user, match.MatchID);

                    if (!details || !details.players || !details.teams) return { ...match, stats: null };

                    detailsById[match.MatchID] = details;

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
            void preloadImageUrls(
                results.flatMap((match) =>
                    match.stats ? [match.stats.agentIcon, match.stats.mapImage] : []
                ),
                { batchSize: 8 }
            );

            set((state) => ({
                matches: results,
                detailsById: {
                    ...state.detailsById,
                    ...detailsById,
                },
                loading: false,
                lastUpdated: Date.now(),
            }));

        } catch (error) {
            console.error("Failed to fetch matches globally", error);
            set({ loading: false });
        }
    }
}));
