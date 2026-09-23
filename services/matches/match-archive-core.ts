import type {
  MatchHistoryRecord,
  MatchHistoryStats,
  SeasonPerformanceStats,
} from "~/types/match-ui";

export const MATCH_ARCHIVE_SCHEMA_VERSION = 1;
export const MAX_ARCHIVED_MATCHES_PER_SEASON = 1_000;

export type MatchArchiveSyncStatus =
  | "observed"
  | "rank-only"
  | "partial"
  | "complete";

export type MatchSeasonArchive = {
  accountKey: string;
  matches: MatchHistoryRecord[];
  schemaVersion: typeof MATCH_ARCHIVE_SCHEMA_VERSION;
  seasonId: string;
  seasonName: string;
  stats: SeasonPerformanceStats | null;
  syncStatus: MatchArchiveSyncStatus;
  updatedAt: number;
};

export type SaveMatchSeasonArchiveInput = Omit<
  MatchSeasonArchive,
  "accountKey" | "schemaVersion" | "seasonId"
> & {
  accountKey: string;
  seasonId: string;
};

export type MatchArchiveDriver = {
  read: (accountKey: string, seasonId: string) => Promise<string | null>;
  write: (
    accountKey: string,
    seasonId: string,
    payload: string
  ) => Promise<void>;
};

export type MatchArchiveRepository = {
  archiveObservedMatches: (
    accountKey: string,
    matches: readonly MatchHistoryRecord[]
  ) => Promise<MatchSeasonArchive[]>;
  loadMatchSeasonArchive: (
    accountKey: string,
    seasonId: string
  ) => Promise<MatchSeasonArchive | null>;
  saveMatchSeasonArchive: (
    input: SaveMatchSeasonArchiveInput
  ) => Promise<MatchSeasonArchive | null>;
};

const VALID_SYNC_STATUSES = new Set<MatchArchiveSyncStatus>([
  "complete",
  "observed",
  "partial",
  "rank-only",
]);

const normalizeSegment = (value: string) =>
  value.trim().toLocaleLowerCase("en-US");

const normalizeScope = (accountKey: string, seasonId: string) => {
  const normalizedAccountKey = normalizeSegment(accountKey);
  const normalizedSeasonId = normalizeSegment(seasonId);
  if (
    !normalizedAccountKey ||
    normalizedAccountKey === "guest" ||
    !normalizedSeasonId
  ) {
    return null;
  }
  return {
    accountKey: normalizedAccountKey,
    seasonId: normalizedSeasonId,
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const hasFiniteFields = (
  value: Record<string, unknown>,
  fields: readonly string[]
) => fields.every((field) => isFiniteNumber(value[field]));

const hasStringFields = (
  value: Record<string, unknown>,
  fields: readonly string[]
) => fields.every((field) => typeof value[field] === "string");

const isMatchHistoryStats = (value: unknown): value is MatchHistoryStats => {
  if (!isRecord(value)) return false;
  return (
    hasFiniteFields(value, [
      "acs",
      "adr",
      "assists",
      "deaths",
      "kd",
      "kills",
      "placement",
      "roundsLost",
      "roundsPlayed",
      "roundsWon",
      "score",
    ]) &&
    hasStringFields(value, [
      "agentName",
      "gameMode",
      "kda",
      "kdRatio",
      "mapName",
    ]) &&
    typeof value.won === "boolean"
  );
};

const isMatchHistoryRecord = (value: unknown): value is MatchHistoryRecord => {
  if (!isRecord(value)) return false;
  const stats = value.stats;
  return (
    typeof value.MatchID === "string" &&
    value.MatchID.trim().length > 0 &&
    isFiniteNumber(value.GameStartTime) &&
    value.GameStartTime >= 0 &&
    typeof value.QueueID === "string" &&
    (stats === undefined || stats === null || isMatchHistoryStats(stats))
  );
};

const isNullableMetric = (value: unknown) =>
  value === null || isFiniteNumber(value);

const isSeasonPerformanceStats = (
  value: unknown
): value is SeasonPerformanceStats => {
  if (!isRecord(value)) return false;
  const completeness = value.dataCompleteness;
  return (
    typeof value.seasonId === "string" &&
    typeof value.seasonName === "string" &&
    hasFiniteFields(value, [
      "bodyshots",
      "calculationVersion",
      "damage",
      "deaths",
      "headshots",
      "kastRounds",
      "kastRoundsPlayed",
      "kills",
      "legshots",
      "losses",
      "matchCount",
      "roundsPlayed",
      "score",
      "updatedAt",
      "wins",
    ]) &&
    [value.acs, value.adr, value.headshotPercent, value.kast, value.kd, value.winRate].every(
      isNullableMetric
    ) &&
    (value.recordingStartedAt === undefined ||
      (isFiniteNumber(value.recordingStartedAt) &&
        value.recordingStartedAt >= 0)) &&
    (completeness === undefined ||
      completeness === "full" ||
      completeness === "partial" ||
      completeness === "rank-only")
  );
};

const statsQuality = (stats: SeasonPerformanceStats | null) => {
  if (!stats) return 0;
  if (stats.dataCompleteness === "rank-only") return 1;
  if (stats.dataCompleteness === "partial") return 2;
  return 3;
};

export const chooseMatchArchiveStats = (
  current: SeasonPerformanceStats | null,
  incoming: SeasonPerformanceStats | null
) => {
  if (!current) return incoming;
  if (!incoming) return current;
  // Match history is append-only. A later zero usually means Riot no longer
  // exposes that Act through the retained-history window, not that old games
  // disappeared; keep the known non-empty snapshot in that case.
  if (current.matchCount > 0 && incoming.matchCount === 0) return current;
  const qualityDelta = statsQuality(incoming) - statsQuality(current);
  if (qualityDelta !== 0) return qualityDelta > 0 ? incoming : current;
  if (incoming.matchCount !== current.matchCount) {
    return incoming.matchCount > current.matchCount ? incoming : current;
  }
  return incoming.updatedAt >= current.updatedAt ? incoming : current;
};

const mergeRecord = (
  current: MatchHistoryRecord,
  incoming: MatchHistoryRecord
): MatchHistoryRecord => {
  const currentHasStats = Boolean(current.stats);
  const incomingHasStats = Boolean(incoming.stats);
  if (currentHasStats && !incomingHasStats) {
    return {
      ...current,
      rankUpdate: incoming.rankUpdate ?? current.rankUpdate,
    };
  }
  return {
    ...current,
    ...incoming,
    rankUpdate: incoming.rankUpdate ?? current.rankUpdate,
    stats: incoming.stats ?? current.stats,
  };
};

export const mergeMatchArchiveRecords = (
  current: readonly MatchHistoryRecord[],
  incoming: readonly MatchHistoryRecord[]
) => {
  const byId = new Map(current.map((match) => [match.MatchID, match]));
  incoming.forEach((match) => {
    const existing = byId.get(match.MatchID);
    byId.set(match.MatchID, existing ? mergeRecord(existing, match) : match);
  });
  return Array.from(byId.values())
    .sort((left, right) => right.GameStartTime - left.GameStartTime)
    .slice(0, MAX_ARCHIVED_MATCHES_PER_SEASON);
};

const parseArchive = (
  payload: string,
  expectedAccountKey: string,
  expectedSeasonId: string
): MatchSeasonArchive | null => {
  try {
    const value: unknown = JSON.parse(payload);
    if (!isRecord(value)) return null;
    if (
      value.schemaVersion !== MATCH_ARCHIVE_SCHEMA_VERSION ||
      normalizeSegment(String(value.accountKey ?? "")) !== expectedAccountKey ||
      normalizeSegment(String(value.seasonId ?? "")) !== expectedSeasonId ||
      typeof value.seasonName !== "string" ||
      !Array.isArray(value.matches) ||
      !isFiniteNumber(value.updatedAt) ||
      !VALID_SYNC_STATUSES.has(value.syncStatus as MatchArchiveSyncStatus) ||
      (value.stats !== null && !isSeasonPerformanceStats(value.stats))
    ) {
      return null;
    }

    return {
      accountKey: expectedAccountKey,
      matches: mergeMatchArchiveRecords(
        [],
        value.matches.filter(isMatchHistoryRecord)
      ),
      schemaVersion: MATCH_ARCHIVE_SCHEMA_VERSION,
      seasonId: expectedSeasonId,
      seasonName: value.seasonName,
      stats: value.stats,
      syncStatus: value.syncStatus as MatchArchiveSyncStatus,
      updatedAt: value.updatedAt,
    };
  } catch {
    return null;
  }
};

const mergeArchive = (
  current: MatchSeasonArchive | null,
  incoming: MatchSeasonArchive
): MatchSeasonArchive => {
  if (!current) {
    return {
      ...incoming,
      matches: mergeMatchArchiveRecords([], incoming.matches),
    };
  }
  const stats = chooseMatchArchiveStats(current.stats, incoming.stats);
  const keptCurrentStats = stats === current.stats && stats !== incoming.stats;
  const incomingSeasonName = incoming.seasonName.trim();
  const currentSeasonName = current.seasonName.trim();
  const incomingHasDisplayName =
    incomingSeasonName.length > 0 &&
    normalizeSegment(incomingSeasonName) !== normalizeSegment(incoming.seasonId);
  const currentHasDisplayName =
    currentSeasonName.length > 0 &&
    normalizeSegment(currentSeasonName) !== normalizeSegment(current.seasonId);
  return {
    ...incoming,
    matches: mergeMatchArchiveRecords(current.matches, incoming.matches),
    seasonName: incomingHasDisplayName
      ? incomingSeasonName
      : currentHasDisplayName
        ? currentSeasonName
        : incomingSeasonName || currentSeasonName || incoming.seasonId,
    stats,
    syncStatus: keptCurrentStats ? current.syncStatus : incoming.syncStatus,
    updatedAt: Math.max(current.updatedAt, incoming.updatedAt),
  };
};

export function createMatchArchiveRepository(
  driver: MatchArchiveDriver
): MatchArchiveRepository {
  const writes = new Map<string, Promise<void>>();
  const operationKey = (accountKey: string, seasonId: string) =>
    `${accountKey}\u0000${seasonId}`;

  const loadMatchSeasonArchive = async (
    accountKey: string,
    seasonId: string
  ) => {
    const scope = normalizeScope(accountKey, seasonId);
    if (!scope) return null;
    const key = operationKey(scope.accountKey, scope.seasonId);
    await writes.get(key);
    const payload = await driver.read(scope.accountKey, scope.seasonId);
    return payload
      ? parseArchive(payload, scope.accountKey, scope.seasonId)
      : null;
  };

  const saveMatchSeasonArchive = async (
    input: SaveMatchSeasonArchiveInput
  ) => {
    const scope = normalizeScope(input.accountKey, input.seasonId);
    if (!scope || !VALID_SYNC_STATUSES.has(input.syncStatus)) return null;
    const key = operationKey(scope.accountKey, scope.seasonId);
    const write = (writes.get(key) ?? Promise.resolve()).then(async () => {
      const payload = await driver.read(scope.accountKey, scope.seasonId);
      const current = payload
        ? parseArchive(payload, scope.accountKey, scope.seasonId)
        : null;
      const incoming: MatchSeasonArchive = {
        accountKey: scope.accountKey,
        matches: input.matches.filter(isMatchHistoryRecord),
        schemaVersion: MATCH_ARCHIVE_SCHEMA_VERSION,
        seasonId: scope.seasonId,
        seasonName: input.seasonName.trim() || scope.seasonId,
        stats: isSeasonPerformanceStats(input.stats) ? input.stats : null,
        syncStatus: input.syncStatus,
        updatedAt: Number.isFinite(input.updatedAt) ? input.updatedAt : Date.now(),
      };
      const result = mergeArchive(current, incoming);
      await driver.write(
        scope.accountKey,
        scope.seasonId,
        JSON.stringify(result)
      );
      return result;
    });
    const tail = write.then(
      () => undefined,
      () => undefined
    );
    writes.set(key, tail);
    try {
      return await write;
    } finally {
      if (writes.get(key) === tail) writes.delete(key);
    }
  };

  const archiveObservedMatches = async (
    accountKey: string,
    matches: readonly MatchHistoryRecord[]
  ) => {
    const grouped = new Map<string, MatchHistoryRecord[]>();
    if (!normalizeScope(accountKey, "observed")) return [];
    matches.forEach((match) => {
      if (!isMatchHistoryRecord(match) || !match.stats) return;
      const seasonId = normalizeSegment(match.stats?.seasonId ?? "");
      if (
        !seasonId ||
        match.QueueID.toLocaleLowerCase("en-US") !== "competitive"
      ) {
        return;
      }
      grouped.set(seasonId, [...(grouped.get(seasonId) ?? []), match]);
    });

    const saved = await Promise.all(
      Array.from(grouped.entries()).map(([seasonId, seasonMatches]) =>
        saveMatchSeasonArchive({
          accountKey,
          matches: seasonMatches,
          seasonId,
          seasonName: seasonId,
          stats: null,
          syncStatus: "observed",
          updatedAt: Date.now(),
        })
      )
    );
    return saved.filter(
      (archive): archive is MatchSeasonArchive => archive !== null
    );
  };

  return {
    archiveObservedMatches,
    loadMatchSeasonArchive,
    saveMatchSeasonArchive,
  };
}
