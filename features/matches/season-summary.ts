import type { MatchDetailsData, SeasonPerformanceStats } from "~/types/match-ui";
import { resolveMatchOutcome } from "~/utils/match-result";
import { SEASON_STATS_CALCULATION_VERSION, KAST_TRADE_WINDOW_MS } from "./cache-policy";

// Season Act competitive được chọn cho thống kê mùa.
export type CompetitiveSeason = {
  id: string;
  name: string;
  startTimeMs: number;
  endTimeMs: number;
};

/**
 * Tính tổng hợp hiệu suất season từ danh sách match details đã crawl.
 * Chỉ tính trận competitive thuộc season được truyền vào (lọc theo seasonId).
 * Các chỉ số: K/D, ACS, ADR, HS%, KAST (kể trade 5s), winRate, wins/losses...
 * Chỉ số tổng chia theo tổng (kd, acs, adr) VÀ chỉ số trung bình per-match
 * được log ở DEV để kiểm chứng khác biệt cách tính.
 * @param detailsList - Match details (có thể chứa null — bị bỏ qua).
 * @param userId - PUUID người chơi cần tổng hợp stats.
 * @param season - Act đang active (lọc + nhãn hiển thị).
 * @returns SeasonPerformanceStats gắn calculationVersion để invalidate
 * khi công thức đổi (SEASON_STATS_CALCULATION_VERSION).
 */
export const summarizeSeasonMatches = (
  detailsList: (MatchDetailsData | null)[],
  userId: string,
  season: CompetitiveSeason
): SeasonPerformanceStats => {
  const totals = {
    matchCount: 0,
    wins: 0,
    losses: 0,
    draws: 0,
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
  };
  const perMatch = {
    kdSum: 0,
    kdCount: 0,
    acsSum: 0,
    acsCount: 0,
    adrSum: 0,
    adrCount: 0,
    headshotPercentSum: 0,
    headshotPercentCount: 0,
  };

  detailsList.forEach((details) => {
    if (
      !details ||
      String(details.matchInfo?.seasonId).toLowerCase() !== season.id.toLowerCase() ||
      String(details.matchInfo?.queueID).toLowerCase() !== "competitive"
    ) {
      return;
    }

    const player = details.players?.find((entry) => entry.subject === userId);
    if (!player?.stats) return;

    const { result } = resolveMatchOutcome(details, userId);
    if (result === "cancelled" || result === "unknown") {
      totals[result] += 1;
      return;
    }
    if (result === "win") totals.wins += 1;
    else if (result === "loss") totals.losses += 1;
    else totals.draws += 1;

    const matchKills = Number(player.stats.kills) || 0;
    const matchDeaths = Number(player.stats.deaths) || 0;
    const matchScore = Number(player.stats.score) || 0;
    const matchRoundsPlayed = Number(player.stats.roundsPlayed) || 0;
    let matchDamage = 0;
    let matchHeadshots = 0;
    let matchBodyshots = 0;
    let matchLegshots = 0;

    const teammateIds = new Set(
      (details.players ?? []).flatMap((entry) =>
        String(entry.teamId).toLowerCase() ===
        String(player.teamId).toLowerCase()
          ? [entry.subject]
          : []
      )
    );

    (details.roundResults ?? []).forEach((round) => {
      const playerStats = round.playerStats?.find(
        (entry) => entry.subject === userId
      );
      if (!playerStats) return;

      playerStats?.damage?.forEach((damage) => {
        matchDamage += Number(damage.damage) || 0;
        matchHeadshots += Number(damage.headshots) || 0;
        matchBodyshots += Number(damage.bodyshots) || 0;
        matchLegshots += Number(damage.legshots) || 0;
      });

      const roundKills = (round.playerStats ?? []).flatMap(
        (entry) => entry.kills ?? []
      );
      const deathEvent = roundKills.find((kill) => kill.victim === userId);
      const hasKill = (playerStats.kills?.length ?? 0) > 0;
      const roundAssistantIds = new Set(
        roundKills.flatMap((kill) => kill.assistants ?? [])
      );
      const hasAssist = roundAssistantIds.has(userId);
      const survived = !deathEvent;
      const wasTraded = Boolean(
        deathEvent &&
          roundKills.some((kill) => {
            const tradeDelay =
              (Number(kill.roundTime) || 0) -
              (Number(deathEvent.roundTime) || 0);
            return (
              kill.victim === deathEvent.killer &&
              teammateIds.has(kill.killer) &&
              tradeDelay >= 0 &&
              tradeDelay <= KAST_TRADE_WINDOW_MS
            );
          })
      );

      totals.kastRoundsPlayed += 1;
      if (hasKill || hasAssist || survived || wasTraded) {
        totals.kastRounds += 1;
      }
    });

    totals.matchCount += 1;
    totals.kills += matchKills;
    totals.deaths += matchDeaths;
    totals.score += matchScore;
    totals.damage += matchDamage;
    totals.roundsPlayed += matchRoundsPlayed;
    totals.headshots += matchHeadshots;
    totals.bodyshots += matchBodyshots;
    totals.legshots += matchLegshots;

    if (matchDeaths > 0) {
      perMatch.kdSum += matchKills / matchDeaths;
      perMatch.kdCount += 1;
    }
    if (matchRoundsPlayed > 0) {
      perMatch.acsSum += matchScore / matchRoundsPlayed;
      perMatch.acsCount += 1;
      perMatch.adrSum += matchDamage / matchRoundsPlayed;
      perMatch.adrCount += 1;
    }
    const matchHits = matchHeadshots + matchBodyshots + matchLegshots;
    if (matchHits > 0) {
      perMatch.headshotPercentSum += (matchHeadshots / matchHits) * 100;
      perMatch.headshotPercentCount += 1;
    }
  });

  const result = {
    calculationVersion: SEASON_STATS_CALCULATION_VERSION,
    dataCompleteness: "full" as const,
    seasonId: season.id,
    seasonName: season.name,
    ...totals,
    headshotPercent:
      perMatch.headshotPercentCount > 0
        ? perMatch.headshotPercentSum / perMatch.headshotPercentCount
        : null,
    kd:
      totals.kills > 0 || totals.deaths > 0
        ? totals.kills / Math.max(1, totals.deaths)
        : null,
    acs:
      totals.roundsPlayed > 0 ? totals.score / totals.roundsPlayed : null,
    adr:
      totals.roundsPlayed > 0 ? totals.damage / totals.roundsPlayed : null,
    kast:
      totals.kastRoundsPlayed > 0
        ? (totals.kastRounds / totals.kastRoundsPlayed) * 100
        : null,
    winRate:
      totals.matchCount > 0 ? (totals.wins / totals.matchCount) * 100 : null,
    updatedAt: Date.now(),
  };
  if (__DEV__) {
    console.log("[season-stats] per-match-average check", {
      kd:
        perMatch.kdCount > 0 ? perMatch.kdSum / perMatch.kdCount : null,
      acs:
        perMatch.acsCount > 0 ? perMatch.acsSum / perMatch.acsCount : null,
      adr:
        perMatch.adrCount > 0 ? perMatch.adrSum / perMatch.adrCount : null,
      headshotPercent:
        perMatch.headshotPercentCount > 0
          ? perMatch.headshotPercentSum / perMatch.headshotPercentCount
          : null,
    });
  }
  return result;
};
