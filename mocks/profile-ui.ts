import type {
  MatchHistoryRecord,
  SeasonPerformanceStats,
} from "~/types/match-ui";
import type { LeaderboardSeasonOption } from "~/utils/leaderboard-seasons";
import type { CompetitiveRankSummary } from "~/utils/profile-cache";
import { defaultUser } from "~/utils/valorant-user";

export const PROFILE_DEMO_CURRENT_SEASON_ID = "profile-demo-e10-a2";

type DemoSeason = readonly [
  id: string,
  name: string,
  startTime: string,
  matchSampleSize: number,
  offsetDays: number,
  acs: number,
  adr: number,
  deaths: number,
  headshotPercent: number,
  kast: number,
  kd: number,
  kills: number,
  losses: number,
  matchCount: number,
  wins: number,
];

const PROFILE_DEMO_SEASONS: readonly DemoSeason[] = [
  [PROFILE_DEMO_CURRENT_SEASON_ID, "Episode 10 · Act 2", "2026-08-01T00:00:00Z", 8, 0, 238, 158.4, 418, 28.6, 74.2, 1.19, 497, 12, 30, 18],
  ["profile-demo-e10-a1", "Episode 10 · Act 1", "2026-05-01T00:00:00Z", 7, 90, 221, 149.1, 386, 25.4, 71.8, 1.08, 417, 13, 28, 15],
  ["profile-demo-e9-a3", "Episode 9 · Act 3", "2026-02-01T00:00:00Z", 6, 180, 207, 141.6, 342, 23.8, 69.5, 0.96, 328, 14, 25, 11],
  ["profile-demo-e9-a2", "Episode 9 · Act 2", "2025-11-01T00:00:00Z", 5, 270, 198, 136.8, 315, 22.9, 68.4, 0.94, 296, 13, 23, 10],
  ["profile-demo-e9-a1", "Episode 9 · Act 1", "2025-08-01T00:00:00Z", 5, 360, 212, 145.2, 301, 24.1, 70.3, 1.02, 307, 10, 22, 12],
  ["profile-demo-e8-a3", "Episode 8 · Act 3", "2025-05-01T00:00:00Z", 4, 450, 204, 139.7, 288, 21.8, 67.9, 0.98, 282, 11, 21, 10],
  ["profile-demo-e8-a2", "Episode 8 · Act 2", "2025-02-01T00:00:00Z", 4, 540, 219, 151.3, 276, 26.2, 72.1, 1.11, 306, 8, 20, 12],
  ["profile-demo-e8-a1", "Episode 8 · Act 1", "2024-11-01T00:00:00Z", 4, 630, 193, 132.5, 259, 20.6, 66.7, 0.91, 236, 10, 18, 8],
];

export const PROFILE_DEMO_USER: typeof defaultUser = {
  ...defaultUser,
  id: "profile-demo-user",
  name: "KONA",
  TagLine: "DEV",
  region: "ap",
  balances: { vp: 2_450, rad: 185, fag: 0, kc: 7_600 },
  progress: { level: 247, xp: 0 },
  accessToken: "",
  entitlementsToken: "",
  idToken: "",
};

export const PROFILE_DEMO_RANK: CompetitiveRankSummary = {
  currentTier: 18,
  currentName: "Diamond 1",
  currentIcon: null,
  peakTier: 20,
  peakName: "Diamond 3",
  peakIcon: null,
  actSeasonId: PROFILE_DEMO_CURRENT_SEASON_ID,
  actWins: 18,
  actLosses: 12,
  actGames: 30,
};

export const PROFILE_DEMO_SEASON_OPTIONS: LeaderboardSeasonOption[] =
  PROFILE_DEMO_SEASONS.map(([id, name, startTime], index) => ({
    id,
    name,
    isActive: index === 0,
    startTime,
  }));

const DAY_MS = 86_400_000;
const DEMO_AGENTS = ["Sova", "Jett", "Omen", "Sage"] as const;
const DEMO_MAPS = ["Ascent", "Haven", "Lotus", "Bind"] as const;
const buildSeasonMatches = (
  season: DemoSeason
): MatchHistoryRecord[] => {
  const [id, , startTime, sampleSize, offsetDays] = season;
  const seasonStartTime = Date.parse(startTime) - offsetDays * DAY_MS;
  return Array.from({ length: sampleSize }, (_, index) => {
    const kills = 22 - index;
    const deaths = 13 + (index % 4);
    const assists = 4 + (index % 5);
    const roundsWon = index % 3 === 2 ? 10 : 13;
    const roundsLost = index % 3 === 2 ? 13 : 9 + (index % 3);
    const won = roundsWon > roundsLost;
    const agentName = DEMO_AGENTS[index % DEMO_AGENTS.length];
    const mapName = DEMO_MAPS[index % DEMO_MAPS.length];
    const kd = kills / deaths;
    return {
      MatchID: `${id}-${index + 1}`,
      GameStartTime: seasonStartTime + (sampleSize - index) * DAY_MS,
      QueueID: "competitive",
      stats: {
        kda: `${kills}/${deaths}/${assists}`,
        kills,
        deaths,
        assists,
        score: kills * 215,
        acs: 205 + index * 4,
        adr: 138 + index * 2,
        kd,
        kdRatio: kd.toFixed(2),
        headshotPercent: 22 + index,
        headshotPct: `${22 + index}%`,
        placement: index + 1,
        roundsPlayed: roundsWon + roundsLost,
        won,
        result: won ? "win" : "loss",
        roundsWon,
        roundsLost,
        agentIcon: null,
        agentId: agentName,
        agentName,
        agentPortrait: null,
        mapId: mapName,
        mapName,
        mapImage: null,
        gameMode: "Competitive",
        seasonId: id,
        rankTier: 18,
        rankName: "Diamond 1",
        rankIcon: null,
        rrEarned: won ? 18 : -16,
        rrAfter: 64,
        rrBefore: won ? 46 : 80,
        rrPerformanceBonus: null,
        rrAfkPenalty: null,
        competitiveMovement: null,
      },
    };
  });
};

const seasonEntries = PROFILE_DEMO_SEASONS.map((season) => {
  const [
    id,
    name,
    ,
    ,
    ,
    acs,
    adr,
    deaths,
    headshotPercent,
    kast,
    kd,
    kills,
    losses,
    matchCount,
    wins,
  ] = season;
  const matches = buildSeasonMatches(season);
  const roundsPlayed = matchCount * 21;
  const stats: SeasonPerformanceStats = {
    calculationVersion: 6,
    seasonId: id,
    seasonName: name,
    matchCount,
    wins,
    losses,
    kills,
    deaths,
    score: Math.round(acs * roundsPlayed),
    damage: Math.round(adr * roundsPlayed),
    roundsPlayed,
    kastRounds: Math.round((kast / 100) * roundsPlayed),
    kastRoundsPlayed: roundsPlayed,
    headshots: Math.round(kills * (headshotPercent / 100)),
    bodyshots: Math.round(kills * 2.15),
    legshots: Math.round(kills * 0.18),
    headshotPercent,
    kd,
    acs,
    adr,
    kast,
    winRate: (wins / matchCount) * 100,
    updatedAt: Date.parse("2026-09-15T00:00:00Z"),
  };
  return [id, matches, stats] as const;
});

export const PROFILE_DEMO_MATCHES_BY_SEASON = Object.fromEntries(
  seasonEntries.map(([id, matches]) => [id, matches])
) as Record<string, MatchHistoryRecord[]>;
export const PROFILE_DEMO_STATS_BY_SEASON = Object.fromEntries(
  seasonEntries.map(([id, , stats]) => [id, stats])
) as Record<string, SeasonPerformanceStats>;
export const PROFILE_DEMO_CURRENT_STATS =
  PROFILE_DEMO_STATS_BY_SEASON[PROFILE_DEMO_CURRENT_SEASON_ID];
export const PROFILE_DEMO_CURRENT_MATCHES =
  PROFILE_DEMO_MATCHES_BY_SEASON[PROFILE_DEMO_CURRENT_SEASON_ID];

export const getProfileDemoSeasonData = (recordingOnly = false) => {
  if (!recordingOnly) {
    return {
      currentMatches: PROFILE_DEMO_CURRENT_MATCHES,
      currentStats: PROFILE_DEMO_CURRENT_STATS,
      seasonMatchesById: PROFILE_DEMO_MATCHES_BY_SEASON,
      seasonOptions: PROFILE_DEMO_SEASON_OPTIONS,
      seasonStatsById: PROFILE_DEMO_STATS_BY_SEASON,
    };
  }
  return {
    currentMatches: PROFILE_DEMO_CURRENT_MATCHES,
    currentStats: PROFILE_DEMO_CURRENT_STATS,
    seasonMatchesById: {
      [PROFILE_DEMO_CURRENT_SEASON_ID]: PROFILE_DEMO_CURRENT_MATCHES,
    },
    seasonOptions: [PROFILE_DEMO_SEASON_OPTIONS[0]],
    seasonStatsById: {
      [PROFILE_DEMO_CURRENT_SEASON_ID]: PROFILE_DEMO_CURRENT_STATS,
    },
  };
};
