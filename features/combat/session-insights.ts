import {
  type CompetitiveMMRResponse,
  getCompetitiveUpdates,
  matchDetails,
} from "~/utils/valorant-api";

export const MAX_TEAM_SIZE = 5;
const RECENT_COMPETITIVE_MATCH_LIMIT = 5;
const COMPETITIVE_STATS_CACHE_TTL_MS = 5 * 60 * 1000;

export type SessionPlayer = {
  subject: string;
  teamId?: string;
  agentId?: string;
  tier?: number;
  ready?: boolean;
  level?: number;
  leaderboardRank?: number;
  isCoach?: boolean;
  isCurrentUser?: boolean;
};

export type PlayerIntel = {
  status: "loading" | "ready" | "private";
  currentTier: number | null;
  currentRr: number | null;
  peakTier: number | null;
  peakSeason: string | null;
};

export type CompetitivePerformance = {
  status: "loading" | "ready" | "private";
  kd: number | null;
  winRate: number | null;
  acs: number | null;
  headshotPercent: number | null;
  matches: number;
  recentResults: {
    matchId: string;
    outcome: "win" | "loss" | "draw";
  }[];
  rrDelta: number | null;
};

export type StatsViewMode = "competitive" | "match";

export type MatchPerformance = {
  status: "loading" | "ready" | "unavailable";
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  acs: number | null;
  headshotPercent: number | null;
  rounds: number;
};

export type ContentSeason = {
  ID: string;
  Name: string;
  Type: "episode" | "act";
  StartTime: string;
  EndTime: string;
  IsActive: boolean;
};

export const EMPTY_INTEL: PlayerIntel = {
  status: "loading",
  currentTier: null,
  currentRr: null,
  peakTier: null,
  peakSeason: null,
};

export const EMPTY_COMPETITIVE_PERFORMANCE: CompetitivePerformance = {
  status: "loading",
  kd: null,
  winRate: null,
  acs: null,
  headshotPercent: null,
  matches: 0,
  recentResults: [],
  rrDelta: null,
};

export const EMPTY_MATCH_PERFORMANCE: MatchPerformance = {
  status: "unavailable",
  kills: null,
  deaths: null,
  assists: null,
  acs: null,
  headshotPercent: null,
  rounds: 0,
};

type MatchDetailsData = Awaited<ReturnType<typeof matchDetails>>;

const competitivePerformanceCache = new Map<
  string,
  { value: CompetitivePerformance; expiresAt: number }
>();
const matchDetailsCache = new Map<string, Promise<MatchDetailsData | null>>();

export const toTier = (value: unknown) => {
  const tier = Number(value ?? 0);
  return Number.isFinite(tier) && tier > 0 ? tier : null;
};

export const getHighestWinningTier = (winsByTier: unknown) => {
  if (!winsByTier || typeof winsByTier !== "object" || Array.isArray(winsByTier)) {
    return 0;
  }

  return Object.entries(winsByTier as Record<string, unknown>).reduce(
    (highestTier, [tierId, winCount]) => {
      const tier = toTier(tierId) || 0;
      const wins = Number(winCount);
      return Number.isFinite(wins) && wins > 0 ? Math.max(highestTier, tier) : highestTier;
    },
    0
  );
};

export const toTitleCase = (value?: string | null) =>
  (value || "")
    .replace(/_/g, " ")
    .toLocaleLowerCase("en-US")
    .replace(/\b\w/g, (letter) => letter.toLocaleUpperCase("en-US"));

const romanToNumber = (value: string) => {
  const romanValues: Record<string, number> = {
    I: 1,
    V: 5,
    X: 10,
    L: 50,
    C: 100,
  };
  const normalized = value.toLocaleUpperCase("en-US");
  let total = 0;

  for (let index = 0; index < normalized.length; index += 1) {
    const current = romanValues[normalized[index]] || 0;
    const next = romanValues[normalized[index + 1]] || 0;
    total += current < next ? -current : current;
  }
  return total > 0 ? String(total) : null;
};

const extractSeasonNumber = (value: string) => {
  const numericMatch = value.match(/\d+/);
  if (numericMatch?.[0]) return numericMatch[0];

  const romanMatch = value.match(/\b([IVXLC]+)\b/i);
  return romanMatch?.[1] ? romanToNumber(romanMatch[1]) : null;
};

export const formatPeakSeason = (
  seasonId: string | null,
  seasons: ContentSeason[]
) => {
  if (!seasonId) return null;

  const act = seasons.find(
    (season) => season.ID.toLocaleLowerCase("en-US") === seasonId.toLocaleLowerCase("en-US")
  );
  if (!act) return null;

  const actStart = new Date(act.StartTime).getTime();
  const episode = seasons.find((season) => {
    if (season.Type !== "episode") return false;
    const start = new Date(season.StartTime).getTime();
    const end = new Date(season.EndTime).getTime();
    return Number.isFinite(actStart) && actStart >= start && actStart < end;
  });
  const episodeNumber = episode ? extractSeasonNumber(episode.Name) : null;
  const actNumber = extractSeasonNumber(act.Name);

  if (episodeNumber && actNumber) {
    return `Episode ${episodeNumber} – Act ${actNumber}`;
  }
  return act.Name || episode?.Name || null;
};

export const buildPlayerIntel = (
  result: CompetitiveMMRResponse | Record<string, never>,
  seasons: ContentSeason[]
): PlayerIntel => {
  const mmr = result as CompetitiveMMRResponse;
  const queueSkills = mmr.QueueSkills;
  const competitive =
    queueSkills?.competitive ||
    Object.entries(queueSkills || {}).find(([queueName]) =>
      queueName.toLocaleLowerCase("en-US").includes("competitive")
    )?.[1];
  const seasonalInfo =
    competitive?.SeasonalInfoBySeasonID &&
    typeof competitive.SeasonalInfoBySeasonID === "object"
      ? competitive.SeasonalInfoBySeasonID
      : {};

  let peakTier = 0;
  let peakSeasonId: string | null = null;

  Object.entries(seasonalInfo).forEach(([seasonId, season]) => {
    const seasonTier = Math.max(
      getHighestWinningTier(season?.WinsByTier),
      toTier(season?.CompetitiveTier) || 0,
      toTier(season?.SeasonHighestCompetitiveTier) || 0
    );
    if (seasonTier > peakTier) {
      peakTier = seasonTier;
      peakSeasonId = seasonId;
    }
  });

  const currentTier =
    toTier(mmr.LatestCompetitiveUpdate?.TierAfterUpdate) ||
    toTier(competitive?.CompetitiveTier);
  const explicitPeak = toTier(competitive?.HighestCompetitiveTier) || 0;
  if (explicitPeak > peakTier) {
    peakTier = explicitPeak;
    peakSeasonId = null;
  }

  const resolvedPeakTier = peakTier > 0 ? peakTier : null;
  const hasRankData = Boolean(currentTier || resolvedPeakTier);

  return {
    status: hasRankData ? "ready" : "private",
    currentTier,
    currentRr: Number.isFinite(Number(mmr.LatestCompetitiveUpdate?.RankedRatingAfterUpdate))
      ? Number(mmr.LatestCompetitiveUpdate?.RankedRatingAfterUpdate)
      : null,
    peakTier: resolvedPeakTier,
    peakSeason: formatPeakSeason(peakSeasonId, seasons),
  };
};

export const mapWithConcurrency = async <T, R>(
  values: readonly T[],
  concurrency: number,
  worker: (value: T) => Promise<R>
) => {
  const results = new Array<R>(values.length);
  let cursor = 0;

  const runWorker = async () => {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(values[index]);
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(Math.max(1, concurrency), values.length) },
      runWorker
    )
  );
  return results;
};

const getCachedMatchDetails = (
  accessToken: string,
  entitlementsToken: string,
  region: string,
  matchId: string
) => {
  const cacheKey = `${region.toLocaleLowerCase("en-US")}|${matchId}`;
  const cached = matchDetailsCache.get(cacheKey);
  if (cached) return cached;

  const request = matchDetails(
    accessToken,
    entitlementsToken,
    region,
    matchId
  ).catch(() => null);
  matchDetailsCache.set(cacheKey, request);

  if (matchDetailsCache.size > 120) {
    const oldestKey = matchDetailsCache.keys().next().value;
    if (oldestKey) matchDetailsCache.delete(oldestKey);
  }
  return request;
};

export const buildCompetitivePerformance = (
  subject: string,
  matchIds: string[],
  detailsById: ReadonlyMap<string, MatchDetailsData>,
  rrDelta: number | null
): CompetitivePerformance => {
  let kills = 0;
  let deaths = 0;
  let score = 0;
  let rounds = 0;
  let wins = 0;
  let matchesWithOutcome = 0;
  let validMatches = 0;
  let headshots = 0;
  let bodyshots = 0;
  let legshots = 0;
  const recentResults: CompetitivePerformance["recentResults"] = [];
  const normalizedSubject = subject.toLocaleLowerCase("en-US");

  matchIds.forEach((matchId) => {
    const details = detailsById.get(matchId);
    if (!details) return;

    const player = details.players.find(
      (entry) =>
        entry.subject.toLocaleLowerCase("en-US") === normalizedSubject
    );
    if (!player?.stats) return;

    validMatches += 1;
    kills += Number(player.stats.kills) || 0;
    deaths += Number(player.stats.deaths) || 0;
    score += Number(player.stats.score) || 0;
    rounds += Number(player.stats.roundsPlayed) || 0;

    const team = details.teams?.find(
      (entry) => entry.teamId === player.teamId
    );
    if (team) {
      matchesWithOutcome += 1;
      if (team.won) {
        wins += 1;
        recentResults.push({ matchId, outcome: "win" });
      } else if (details.teams?.some((entry) => entry.teamId !== player.teamId && entry.won)) {
        recentResults.push({ matchId, outcome: "loss" });
      } else {
        recentResults.push({ matchId, outcome: "draw" });
      }
    }

    (details.roundResults || []).forEach((round) => {
      const roundPlayer = round.playerStats.find(
        (entry) =>
          entry.subject.toLocaleLowerCase("en-US") === normalizedSubject
      );
      (roundPlayer?.damage || []).forEach((damage) => {
        headshots += Number(damage.headshots) || 0;
        bodyshots += Number(damage.bodyshots) || 0;
        legshots += Number(damage.legshots) || 0;
      });
    });
  });

  if (validMatches === 0) {
    return { ...EMPTY_COMPETITIVE_PERFORMANCE, status: "private" };
  }

  const totalHits = headshots + bodyshots + legshots;
  return {
    status: "ready",
    kd: kills / Math.max(1, deaths),
    winRate:
      matchesWithOutcome > 0 ? (wins / matchesWithOutcome) * 100 : null,
    acs: rounds > 0 ? score / rounds : null,
    headshotPercent: totalHits > 0 ? (headshots / totalHits) * 100 : null,
    matches: validMatches,
    recentResults,
    rrDelta,
  };
};

export const buildMatchPerformanceBySubject = (
  details: MatchDetailsData,
  subjects: string[]
) => {
  const hitsBySubject = new Map<
    string,
    { headshots: number; bodyshots: number; legshots: number }
  >();

  (details.roundResults || []).forEach((round) => {
    round.playerStats.forEach((roundPlayer) => {
      const subject = roundPlayer.subject.toLocaleLowerCase("en-US");
      const hits = hitsBySubject.get(subject) || {
        headshots: 0,
        bodyshots: 0,
        legshots: 0,
      };
      roundPlayer.damage.forEach((damage) => {
        hits.headshots += Number(damage.headshots) || 0;
        hits.bodyshots += Number(damage.bodyshots) || 0;
        hits.legshots += Number(damage.legshots) || 0;
      });
      hitsBySubject.set(subject, hits);
    });
  });

  return subjects.reduce<Record<string, MatchPerformance>>(
    (performanceBySubject, subject) => {
      const normalizedSubject = subject.toLocaleLowerCase("en-US");
      const player = details.players.find(
        (entry) =>
          entry.subject.toLocaleLowerCase("en-US") === normalizedSubject
      );
      const stats = player?.stats;
      if (!stats) {
        performanceBySubject[normalizedSubject] = EMPTY_MATCH_PERFORMANCE;
        return performanceBySubject;
      }

      const hits = hitsBySubject.get(normalizedSubject);
      const totalHits = hits
        ? hits.headshots + hits.bodyshots + hits.legshots
        : 0;
      const rounds = Number(stats.roundsPlayed) || 0;
      performanceBySubject[normalizedSubject] = {
        status: "ready",
        kills: Number(stats.kills) || 0,
        deaths: Number(stats.deaths) || 0,
        assists: Number(stats.assists) || 0,
        acs: rounds > 0 ? (Number(stats.score) || 0) / rounds : null,
        headshotPercent:
          hits && totalHits > 0 ? (hits.headshots / totalHits) * 100 : null,
        rounds,
      };
      return performanceBySubject;
    },
    {}
  );
};

export const fetchCompetitivePerformanceBatch = async (
  credentials: {
    accessToken: string;
    entitlementsToken: string;
    region: string;
  },
  subjects: string[]
) => {
  const now = Date.now();
  const resolved: Record<string, CompetitivePerformance> = {};
  const missingSubjects: string[] = [];

  subjects.forEach((subject) => {
    const cacheKey = `${credentials.region.toLocaleLowerCase("en-US")}|${subject}`;
    const cached = competitivePerformanceCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      resolved[subject] = cached.value;
    } else {
      missingSubjects.push(subject);
    }
  });

  const histories = await mapWithConcurrency(
    missingSubjects,
    3,
    async (subject) => {
      const updates = await getCompetitiveUpdates(
        credentials.accessToken,
        credentials.entitlementsToken,
        credentials.region,
        subject,
        {
          startIndex: 0,
          endIndex: RECENT_COMPETITIVE_MATCH_LIMIT,
          queue: "competitive",
        }
      ).catch(() => null);

      const recentUpdates = (updates?.Matches || []).slice(
        0,
        RECENT_COMPETITIVE_MATCH_LIMIT
      );
      const matchIds: string[] = [];
      const rrChanges: number[] = [];
      recentUpdates.forEach((match) => {
        if (match.MatchID) matchIds.push(match.MatchID);
        const rrChange = Number(match.RankedRatingEarned);
        if (Number.isFinite(rrChange)) rrChanges.push(rrChange);
      });

      return {
        subject,
        matchIds,
        rrDelta:
          rrChanges.length > 0
            ? rrChanges.reduce((total, change) => total + change, 0)
            : null,
      };
    }
  );

  const uniqueMatchIds = Array.from(
    new Set(histories.flatMap((history) => history.matchIds))
  );
  const detailEntries = await mapWithConcurrency(
    uniqueMatchIds,
    4,
    async (matchId) =>
      [
        matchId,
        await getCachedMatchDetails(
          credentials.accessToken,
          credentials.entitlementsToken,
          credentials.region,
          matchId
        ),
      ] as const
  );
  const detailsById = new Map(
    detailEntries.filter(
      (entry): entry is readonly [string, MatchDetailsData] =>
        Boolean(entry[1])
    )
  );

  histories.forEach(({ subject, matchIds, rrDelta }) => {
    const performance = buildCompetitivePerformance(
      subject,
      matchIds,
      detailsById,
      rrDelta
    );
    resolved[subject] = performance;
    competitivePerformanceCache.set(
      `${credentials.region.toLocaleLowerCase("en-US")}|${subject}`,
      {
        value: performance,
        expiresAt: Date.now() + COMPETITIVE_STATS_CACHE_TTL_MS,
      }
    );
  });

  return resolved;
};

export const formatCompetitiveMetric = (
  value: number | null,
  digits: number,
  suffix = ""
) => (value === null ? "—" : `${value.toFixed(digits)}${suffix}`);
