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
    acs: number;
    kdRatio: string;
    headshotPct: string | null;
    roundsPlayed: number;
    won: boolean;
    roundsWon: number;
    roundsLost: number;
    agentIcon: string;
    mapName: string;
    mapImage: string;
    gameMode: string;
    rankTier: number | null;
    rankName: string | null;
    rankIcon: string | null;
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
        const cachedMatches = get().matches;
        const hasOnlyCompetitiveCached =
            cachedMatches.length > 0 &&
            cachedMatches.every((match) =>
                String(match.QueueID || "").toLowerCase().includes("competitive")
            );
        // Prevent frequent refetching (e.g., 5 minutes cache)
        if (
            Date.now() - get().lastUpdated < 5 * 60 * 1000 &&
            cachedMatches.length > 0 &&
            hasOnlyCompetitiveCached
        ) {
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
                { startIndex: 0, endIndex: 40, queue: "competitive" }
            );

            const historyRaw = historyData.History || [];
            const competitiveOnly = historyRaw.filter((match: any) =>
                String(match?.QueueID || "").toLowerCase().includes("competitive")
            );
            const historyList = (competitiveOnly.length > 0 ? competitiveOnly : historyRaw).slice(0, 20);
            const assets = getAssets();
            const agents = getAgent().agents;
            const tierMap = new Map<number, any>();
            (assets.competitiveTiers || []).forEach((season: any) => {
                (season?.tiers || []).forEach((tier: any) => {
                    const tierNumber = Number(tier?.tier);
                    if (Number.isFinite(tierNumber) && tierNumber > 0 && !tierMap.has(tierNumber)) {
                        tierMap.set(tierNumber, tier);
                    }
                });
            });
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
                    const roundsPlayed =
                        myself.stats?.roundsPlayed ||
                        myTeam?.roundsPlayed ||
                        (myTeam ? myTeam.roundsWon + (myTeam.roundsPlayed - myTeam.roundsWon) : 0) ||
                        0;
                    const kills = myself.stats?.kills || 0;
                    const deaths = myself.stats?.deaths || 0;
                    const assists = myself.stats?.assists || 0;
                    const score = myself.stats?.score || 0;
                    const roundResults = Array.isArray(details.roundResults)
                        ? details.roundResults
                        : [];
                    const damageEvents = roundResults.flatMap((round: any) =>
                        (Array.isArray(round?.playerStats) ? round.playerStats : [])
                            .filter((playerStat: any) => playerStat.subject === user.id)
                            .flatMap((playerStat: any) =>
                                Array.isArray(playerStat?.damage) ? playerStat.damage : []
                            )
                    );
                    const headshots = damageEvents.reduce(
                        (total: number, damage: any) => total + (damage?.headshots || 0),
                        0
                    );
                    const bodyshots = damageEvents.reduce(
                        (total: number, damage: any) => total + (damage?.bodyshots || 0),
                        0
                    );
                    const legshots = damageEvents.reduce(
                        (total: number, damage: any) => total + (damage?.legshots || 0),
                        0
                    );
                    const totalShots = headshots + bodyshots + legshots;

                    const mapInfo = assets.maps ? assets.maps.find((m: any) => m.mapUrl === details.matchInfo?.mapId) : null;
                    const agentInfo = agents ? agents.find((a: any) => a.uuid === myself.characterId) : null;
                    const rawRankTier = Number(
                        myself?.competitiveTier ??
                        myself?.competitiveTierId ??
                        0
                    );
                    const rankTier =
                        Number.isFinite(rawRankTier) && rawRankTier > 0
                            ? rawRankTier
                            : null;
                    const rankName =
                        typeof myself?.competitiveTierName === "string" &&
                        myself.competitiveTierName.trim().length > 0
                            ? myself.competitiveTierName
                            : null;
                    const tierInfo = rankTier ? tierMap.get(rankTier) : null;
                    const rankIcon =
                        tierInfo?.smallIcon ||
                        tierInfo?.largeIcon ||
                        tierInfo?.rankTriangleDownIcon ||
                        null;

                    return {
                        ...match,
                        stats: {
                            kda: `${kills}/${deaths}/${assists}`,
                            kills,
                            deaths,
                            assists,
                            score,
                            acs: roundsPlayed > 0 ? Math.round(score / roundsPlayed) : 0,
                            kdRatio: deaths > 0 ? (kills / deaths).toFixed(2) : kills.toFixed(2),
                            headshotPct:
                                totalShots > 0 ? `${Math.round((headshots / totalShots) * 100)}%` : null,
                            roundsPlayed,
                            won: myTeam ? myTeam.won : false,
                            roundsWon: myTeam ? myTeam.roundsWon : 0,
                            roundsLost: myTeam ? (myTeam.roundsPlayed - myTeam.roundsWon) : 0,
                            agentIcon: agentInfo?.displayIcon,
                            mapName: mapInfo?.displayName || details.matchInfo.mapId,
                            mapImage: mapInfo?.listViewIcon || mapInfo?.splash,
                            gameMode: details.matchInfo.gameMode,
                            rankTier,
                            rankName: rankName || tierInfo?.tierName || null,
                            rankIcon,
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
                    match.stats
                        ? [match.stats.agentIcon, match.stats.mapImage, match.stats.rankIcon]
                        : []
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
