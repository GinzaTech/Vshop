import type { DailyMatchSummary, MatchAssetCatalog, MatchDetailsData, MatchHistoryGroup, MatchHistoryItem, MatchHistoryRecord, MatchHistoryStats, RankUpdate } from "~/types/match-ui";
import { getMatchHistoryResult, resolveMatchOutcome } from "~/utils/match-result";
import { numberOrZero, optionalNumber } from "./common";
import { createMatchAssetCatalog, resolveAgentAsset, resolveMapAsset } from "./assets";
import { buildMatchDetailViewModel } from "./detail";
export function compactRankUpdate(value: unknown): RankUpdate | null {
  if (!value || typeof value !== "object") return null;
  const entry = value as Record<string, unknown>;

  return {
    TierAfterUpdate: optionalNumber(entry.TierAfterUpdate),
    RankedRatingEarned: optionalNumber(entry.RankedRatingEarned),
    RankedRatingAfterUpdate: optionalNumber(entry.RankedRatingAfterUpdate),
    RankedRatingBeforeUpdate: optionalNumber(entry.RankedRatingBeforeUpdate),
    RankedRatingPerformanceBonus: optionalNumber(
      entry.RankedRatingPerformanceBonus
    ),
    AFKPenalty: optionalNumber(entry.AFKPenalty),
    CompetitiveMovement:
      typeof entry.CompetitiveMovement === "string"
        ? entry.CompetitiveMovement
        : undefined,
  };
}

export function buildMatchHistoryRecord(
  match: MatchHistoryRecord,
  details: MatchDetailsData | null,
  userId: string,
  catalog: MatchAssetCatalog = createMatchAssetCatalog()
): MatchHistoryRecord {
  if (!details?.players) {
    return { ...match, stats: null };
  }

  const player = details.players.find((entry) => entry.subject === userId);
  if (!player?.stats) return { ...match, stats: null };

  const viewModel = buildMatchDetailViewModel(details, userId, catalog);
  const scoreboardPlayer = viewModel.players.find(
    (entry) => entry.playerId === userId
  );
  const performance = viewModel.playerPerformance[userId];
  if (!scoreboardPlayer || !performance) return { ...match, stats: null };

  const result = resolveMatchOutcome(details, userId).result;
  const ownScore =
    scoreboardPlayer.team === "A"
      ? viewModel.match.teamAScore
      : viewModel.match.teamBScore;
  const opponentScore =
    scoreboardPlayer.team === "A"
      ? viewModel.match.teamBScore
      : viewModel.match.teamAScore;
  const rankTier = numberOrZero(
    match.rankUpdate?.TierAfterUpdate ?? player.competitiveTier
  );
  const tier = catalog.tiersByNumber.get(rankTier);
  const agent = resolveAgentAsset(catalog, player.characterId);
  const map = resolveMapAsset(catalog, details.matchInfo?.mapId);
  const roundsPlayed = Math.max(1, numberOrZero(player.stats.roundsPlayed));
  const hs = scoreboardPlayer.headshotPercent;
  const stats: MatchHistoryStats = {
    kda: `${scoreboardPlayer.kills}/${scoreboardPlayer.deaths}/${scoreboardPlayer.assists}`,
    kills: scoreboardPlayer.kills,
    deaths: scoreboardPlayer.deaths,
    assists: scoreboardPlayer.assists,
    score: numberOrZero(player.stats.score),
    acs: scoreboardPlayer.acs,
    adr: scoreboardPlayer.adr,
    kd: scoreboardPlayer.kd,
    kdRatio: scoreboardPlayer.kd.toFixed(2),
    headshotPercent: hs ?? null,
    headshotPct: hs === undefined ? null : `${Math.round(hs)}%`,
    placement:
      [...viewModel.players]
        .sort((left, right) => right.acs - left.acs)
        .findIndex((entry) => entry.playerId === userId) + 1,
    roundsPlayed,
    won: result === "win",
    result,
    roundsWon: ownScore,
    roundsLost: opponentScore,
    agentIcon: agent?.displayIcon || agent?.displayIconSmall || null,
    agentId: player.characterId || null,
    agentName: agent?.displayName || "Agent",
    agentPortrait:
      agent?.bustPortrait || agent?.fullPortraitV2 || agent?.fullPortrait || null,
    mapId: details.matchInfo?.mapId || null,
    mapName: map?.displayName || details.matchInfo?.mapId || "Unknown",
    mapImage: map?.listViewIcon || map?.splash || null,
    gameMode: details.matchInfo?.gameMode || match.QueueID || "",
    seasonId: details.matchInfo?.seasonId || null,
    rankTier: rankTier > 0 ? rankTier : null,
    rankName: tier?.tierName || scoreboardPlayer.rank?.name || null,
    rankIcon:
      tier?.smallIcon ||
      tier?.largeIcon ||
      tier?.rankTriangleDownIcon ||
      scoreboardPlayer.rank?.iconUrl ||
      null,
    rrEarned: getRankedRatingChange(match.rankUpdate) ?? null,
    rrAfter:
      optionalNumber(match.rankUpdate?.RankedRatingAfterUpdate) ?? null,
    rrBefore:
      optionalNumber(match.rankUpdate?.RankedRatingBeforeUpdate) ?? null,
    rrPerformanceBonus:
      optionalNumber(match.rankUpdate?.RankedRatingPerformanceBonus) ?? null,
    rrAfkPenalty: optionalNumber(match.rankUpdate?.AFKPenalty) ?? null,
    competitiveMovement: match.rankUpdate?.CompetitiveMovement ?? null,
  };

  return { ...match, stats };
}

/**
 * Re-resolve visual metadata for records restored from persistent storage.
 * A cold start can hydrate the Zustand cache before Valorant's asset catalog is
 * loaded, leaving otherwise valid records with raw map paths and placeholders.
 */
export function enrichMatchHistoryAssets(
  records: readonly MatchHistoryRecord[],
  catalog: MatchAssetCatalog = createMatchAssetCatalog()
): MatchHistoryRecord[] {
  return records.map((record) => {
    const stats = record.stats;
    if (!stats) return record;

    const agent = resolveAgentAsset(catalog, stats.agentId);
    const map = resolveMapAsset(catalog, stats.mapId);
    const tier = stats.rankTier
      ? catalog.tiersByNumber.get(stats.rankTier)
      : undefined;
    const next = {
      agentIcon:
        agent?.displayIcon || agent?.displayIconSmall || stats.agentIcon,
      agentName: agent?.displayName || stats.agentName,
      agentPortrait:
        agent?.bustPortrait ||
        agent?.fullPortraitV2 ||
        agent?.fullPortrait ||
        stats.agentPortrait,
      mapName: map?.displayName || stats.mapName,
      mapImage: map?.listViewIcon || map?.splash || stats.mapImage,
      rankName: tier?.tierName || stats.rankName,
      rankIcon:
        tier?.smallIcon ||
        tier?.largeIcon ||
        tier?.rankTriangleDownIcon ||
        stats.rankIcon,
    };

    if (
      next.agentIcon === stats.agentIcon &&
      next.agentName === stats.agentName &&
      next.agentPortrait === stats.agentPortrait &&
      next.mapName === stats.mapName &&
      next.mapImage === stats.mapImage &&
      next.rankName === stats.rankName &&
      next.rankIcon === stats.rankIcon
    ) {
      return record;
    }

    return { ...record, stats: { ...stats, ...next } };
  });
}

export function toMatchHistoryItem(
  match: MatchHistoryRecord
): MatchHistoryItem | null {
  const stats = match.stats;
  if (!stats) return null;

  return {
    id: match.MatchID,
    startedAt: new Date(match.GameStartTime).toISOString(),
    result: getMatchHistoryResult(stats),
    teamScore: stats.roundsWon,
    opponentScore: stats.roundsLost,
    mode: match.QueueID || stats.gameMode,
    mapName: stats.mapName,
    mapImageUrl: stats.mapImage ?? undefined,
    agent: {
      id: stats.agentId || "unknown-agent",
      name: stats.agentName,
      iconUrl: stats.agentIcon ?? undefined,
    },
    rank:
      stats.rankTier && stats.rankName
        ? {
            tier: stats.rankTier,
            name: stats.rankName,
            iconUrl: stats.rankIcon ?? undefined,
          }
        : undefined,
    placement: Math.max(1, stats.placement),
    kills: stats.kills,
    deaths: stats.deaths,
    assists: stats.assists,
    kd: stats.kd,
    headshotPercent: stats.headshotPercent ?? undefined,
    adr: stats.adr,
    acs: stats.acs,
    rrAfter:
      stats.rrAfter ??
      optionalNumber(match.rankUpdate?.RankedRatingAfterUpdate) ??
      undefined,
    rrChange:
      stats.rrEarned ?? getRankedRatingChange(match.rankUpdate) ?? undefined,
  };
}

export function getRankedRatingChange(
  rankUpdate: RankUpdate | null | undefined,
): number | undefined {
  const earned = optionalNumber(rankUpdate?.RankedRatingEarned);
  if (earned !== undefined) return earned;

  const after = optionalNumber(rankUpdate?.RankedRatingAfterUpdate);
  const before = optionalNumber(rankUpdate?.RankedRatingBeforeUpdate);
  return after !== undefined && before !== undefined
    ? after - before
    : undefined;
}

const localDateKey = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export function buildMatchHistoryGroups(
  records: readonly MatchHistoryRecord[],
  locale: string
): MatchHistoryGroup[] {
  const grouped = new Map<string, MatchHistoryItem[]>();
  records
    .map(toMatchHistoryItem)
    .filter((item): item is MatchHistoryItem => Boolean(item))
    .sort(
      (left, right) =>
        new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime()
    )
    .forEach((item) => {
      const dateKey = localDateKey(new Date(item.startedAt));
      grouped.set(dateKey, [...(grouped.get(dateKey) ?? []), item]);
    });

  return Array.from(grouped.entries()).map(([dateKey, matches]) => {
    const count = matches.length;
    const average = (read: (item: MatchHistoryItem) => number) =>
      count > 0
        ? matches.reduce((total, item) => total + read(item), 0) / count
        : undefined;
    const summary: DailyMatchSummary = {
      dateKey,
      dateLabel: new Date(matches[0].startedAt).toLocaleDateString(locale, {
        month: "short",
        day: "numeric",
      }),
      matchCount: count,
      averageKD: average((item) => item.kd),
      averageADR: average((item) => item.adr),
      averageACS: average((item) => item.acs),
    };

    return { dateKey, summary, matches };
  });
}
