import { mockMatchHistory } from "~/mocks/match-ui";
import type {
  MatchHistoryRecord,
  SeasonPerformanceStats,
} from "~/types/match-ui";
import type { LeaderboardSeasonOption } from "~/utils/leaderboard-seasons";
import type { CompetitiveRankSummary } from "~/utils/profile-cache";
import { defaultUser } from "~/utils/valorant-user";

export const PROFILE_DEMO_CURRENT_SEASON_ID = "profile-demo-e10-a2";
const PROFILE_DEMO_PREVIOUS_SEASON_ID = "profile-demo-e10-a1";
const PROFILE_DEMO_OLDER_SEASON_ID = "profile-demo-e9-a3";

export const PROFILE_DEMO_USER: typeof defaultUser = {
  ...defaultUser,
  id: "profile-demo-user",
  name: "KONA",
  TagLine: "DEV",
  region: "ap",
  balances: {
    vp: 2_450,
    rad: 185,
    fag: 0,
    kc: 7_600,
  },
  progress: {
    level: 247,
    xp: 0,
  },
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

export const PROFILE_DEMO_SEASON_OPTIONS: LeaderboardSeasonOption[] = [
  {
    id: PROFILE_DEMO_CURRENT_SEASON_ID,
    name: "Episode 10 · Act 2",
    isActive: true,
    startTime: "2026-08-01T00:00:00Z",
  },
  {
    id: PROFILE_DEMO_PREVIOUS_SEASON_ID,
    name: "Episode 10 · Act 1",
    isActive: false,
    startTime: "2026-05-01T00:00:00Z",
  },
  {
    id: PROFILE_DEMO_OLDER_SEASON_ID,
    name: "Episode 9 · Act 3",
    isActive: false,
    startTime: "2026-02-01T00:00:00Z",
  },
];

const buildSeasonMatches = (
  seasonId: string,
  idSuffix: string,
  count: number,
  timeOffsetMs: number
): MatchHistoryRecord[] =>
  mockMatchHistory.slice(0, count).map((match, index) => ({
    ...match,
    MatchID: `${match.MatchID}-${idSuffix}`,
    GameStartTime: match.GameStartTime - timeOffsetMs - index * 60_000,
    stats: match.stats
      ? {
          ...match.stats,
          seasonId,
        }
      : null,
  }));

export const PROFILE_DEMO_MATCHES_BY_SEASON: Record<
  string,
  MatchHistoryRecord[]
> = {
  [PROFILE_DEMO_CURRENT_SEASON_ID]: buildSeasonMatches(
    PROFILE_DEMO_CURRENT_SEASON_ID,
    "e10-a2",
    8,
    0
  ),
  [PROFILE_DEMO_PREVIOUS_SEASON_ID]: buildSeasonMatches(
    PROFILE_DEMO_PREVIOUS_SEASON_ID,
    "e10-a1",
    7,
    90 * 24 * 60 * 60 * 1000
  ),
  [PROFILE_DEMO_OLDER_SEASON_ID]: buildSeasonMatches(
    PROFILE_DEMO_OLDER_SEASON_ID,
    "e9-a3",
    6,
    180 * 24 * 60 * 60 * 1000
  ),
};

const buildSeasonStats = (
  seasonId: string,
  seasonName: string,
  values: {
    acs: number;
    adr: number;
    deaths: number;
    headshotPercent: number;
    kast: number;
    kd: number;
    kills: number;
    losses: number;
    matchCount: number;
    wins: number;
  }
): SeasonPerformanceStats => ({
  calculationVersion: 6,
  seasonId,
  seasonName,
  matchCount: values.matchCount,
  wins: values.wins,
  losses: values.losses,
  kills: values.kills,
  deaths: values.deaths,
  score: Math.round(values.acs * values.matchCount * 21),
  damage: Math.round(values.adr * values.matchCount * 21),
  roundsPlayed: values.matchCount * 21,
  kastRounds: Math.round((values.kast / 100) * values.matchCount * 21),
  kastRoundsPlayed: values.matchCount * 21,
  headshots: Math.round(values.kills * (values.headshotPercent / 100)),
  bodyshots: Math.round(values.kills * 2.15),
  legshots: Math.round(values.kills * 0.18),
  headshotPercent: values.headshotPercent,
  kd: values.kd,
  acs: values.acs,
  adr: values.adr,
  kast: values.kast,
  winRate: (values.wins / values.matchCount) * 100,
  updatedAt: Date.parse("2026-09-15T00:00:00Z"),
});

export const PROFILE_DEMO_STATS_BY_SEASON: Record<
  string,
  SeasonPerformanceStats
> = {
  [PROFILE_DEMO_CURRENT_SEASON_ID]: buildSeasonStats(
    PROFILE_DEMO_CURRENT_SEASON_ID,
    "Episode 10 · Act 2",
    {
      acs: 238,
      adr: 158.4,
      deaths: 418,
      headshotPercent: 28.6,
      kast: 74.2,
      kd: 1.19,
      kills: 497,
      losses: 12,
      matchCount: 30,
      wins: 18,
    }
  ),
  [PROFILE_DEMO_PREVIOUS_SEASON_ID]: buildSeasonStats(
    PROFILE_DEMO_PREVIOUS_SEASON_ID,
    "Episode 10 · Act 1",
    {
      acs: 221,
      adr: 149.1,
      deaths: 386,
      headshotPercent: 25.4,
      kast: 71.8,
      kd: 1.08,
      kills: 417,
      losses: 13,
      matchCount: 28,
      wins: 15,
    }
  ),
  [PROFILE_DEMO_OLDER_SEASON_ID]: buildSeasonStats(
    PROFILE_DEMO_OLDER_SEASON_ID,
    "Episode 9 · Act 3",
    {
      acs: 207,
      adr: 141.6,
      deaths: 342,
      headshotPercent: 23.8,
      kast: 69.5,
      kd: 0.96,
      kills: 328,
      losses: 14,
      matchCount: 25,
      wins: 11,
    }
  ),
};

export const PROFILE_DEMO_CURRENT_STATS =
  PROFILE_DEMO_STATS_BY_SEASON[PROFILE_DEMO_CURRENT_SEASON_ID];
export const PROFILE_DEMO_CURRENT_MATCHES =
  PROFILE_DEMO_MATCHES_BY_SEASON[PROFILE_DEMO_CURRENT_SEASON_ID];
