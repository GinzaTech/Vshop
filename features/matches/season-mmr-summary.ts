import type {
  CompetitiveMMRResponse,
  CompetitiveSeasonInfo,
} from "~/services/riot/api-types";
import { getCompetitiveQueueSkill } from "~/utils/profile-rank";
import type { SeasonPerformanceStats } from "~/types/match-ui";
import { SEASON_STATS_CALCULATION_VERSION } from "./cache-policy";
import type { CompetitiveSeason } from "./season-summary";

const toNonNegativeNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? Math.max(0, numericValue) : null;
};

// getCompetitiveQueueSkill dùng bản chuẩn trong utils/profile-rank (bản bộ
// cục bộ cũ thiếu guard typeof === "object" — đã gộp về một implementation).

const getSeasonInfo = (
  result: CompetitiveMMRResponse,
  seasonId: string
): CompetitiveSeasonInfo | null => {
  const seasonalInfo = getCompetitiveQueueSkill(result)?.SeasonalInfoBySeasonID;
  if (!seasonalInfo) return null;
  const normalizedSeasonId = seasonId.toLocaleLowerCase("en-US");
  return (
    Object.entries(seasonalInfo).find(
      ([candidateId]) =>
        candidateId.toLocaleLowerCase("en-US") === normalizedSeasonId
    )?.[1] ?? null
  );
};

/**
 * MMR giữ số trận/thắng/thua theo Act lâu hơn match-history. Nó không chứa
 * combat detail, vì vậy các metric không có nguồn luôn để null thay vì bịa 0.
 */
export function buildMmrSeasonPerformanceStats(
  result: CompetitiveMMRResponse,
  season: CompetitiveSeason,
  updatedAt = Date.now()
): SeasonPerformanceStats | null {
  const info = getSeasonInfo(result, season.id);
  if (!info) return null;

  const winsWithPlacements = toNonNegativeNumber(
    info.NumberOfWinsWithPlacements
  );
  const rawWins = toNonNegativeNumber(info.NumberOfWins);
  const winsByTier = Object.values(info.WinsByTier ?? {}).reduce(
    (total, value) => total + (toNonNegativeNumber(value) ?? 0),
    0
  );
  const wins = winsWithPlacements ?? (winsByTier > 0 ? winsByTier : rawWins);
  const games = toNonNegativeNumber(info.NumberOfGames);
  const explicitLosses = toNonNegativeNumber(info.NumberOfLosses);
  const explicitDraws = toNonNegativeNumber(info.NumberOfDraws);

  if (
    wins === null &&
    games === null &&
    explicitLosses === null &&
    explicitDraws === null
  ) {
    return null;
  }

  const resolvedWins = wins ?? 0;
  const draws = explicitDraws ?? 0;
  const losses =
    explicitLosses ?? Math.max(0, (games ?? resolvedWins + draws) - resolvedWins - draws);
  const matchCount = games ?? resolvedWins + losses + draws;
  const ratedMatchCount = resolvedWins + losses + draws;

  return {
    calculationVersion: SEASON_STATS_CALCULATION_VERSION,
    seasonId: season.id,
    seasonName: season.name,
    dataCompleteness: "rank-only",
    matchCount,
    wins: resolvedWins,
    losses,
    draws,
    cancelled: 0,
    unknown: 0,
    kills: 0,
    deaths: 0,
    score: 0,
    damage: 0,
    roundsPlayed: 0,
    kastRounds: 0,
    kastRoundsPlayed: 0,
    headshots: 0,
    bodyshots: 0,
    legshots: 0,
    headshotPercent: null,
    kd: null,
    acs: null,
    adr: null,
    kast: null,
    winRate:
      ratedMatchCount > 0 ? (resolvedWins / ratedMatchCount) * 100 : null,
    updatedAt,
  };
}
