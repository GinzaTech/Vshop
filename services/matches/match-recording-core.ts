import type { MatchHistoryRecord } from "~/types/match-ui";
import type { LeaderboardSeasonOption } from "~/utils/leaderboard-seasons";

export const MATCH_RECORDING_SCHEMA_VERSION = 1;

export type MatchRecordingBaseline = {
  accountKey: string;
  schemaVersion: typeof MATCH_RECORDING_SCHEMA_VERSION;
  startedAt: number;
  startSeasonId: string | null;
};

export type MatchRecordingDriver = {
  read: (accountKey: string) => Promise<string | null>;
  write: (accountKey: string, payload: string) => Promise<void>;
};

export type MatchRecordingRepository = {
  load: (accountKey: string) => Promise<MatchRecordingBaseline | null>;
  ensure: (
    accountKey: string,
    now?: number
  ) => Promise<{
    baseline: MatchRecordingBaseline;
    created: boolean;
  } | null>;
  bindSeason: (
    accountKey: string,
    seasonId: string
  ) => Promise<MatchRecordingBaseline | null>;
};

const normalizeSegment = (value: string) =>
  value.trim().toLocaleLowerCase("en-US");

const normalizeAccountKey = (value: string) => {
  const normalized = normalizeSegment(value);
  return normalized && normalized !== "guest" ? normalized : null;
};

const normalizeSeasonId = (value: string | null | undefined) => {
  if (typeof value !== "string") return null;
  const normalized = normalizeSegment(value);
  return normalized || null;
};

const parseBaseline = (
  payload: string,
  expectedAccountKey: string
): MatchRecordingBaseline | null => {
  try {
    const value: unknown = JSON.parse(payload);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    const record = value as Record<string, unknown>;
    const accountKey = normalizeAccountKey(String(record.accountKey ?? ""));
    const startedAt = Number(record.startedAt);
    const rawSeasonId = record.startSeasonId;
    const startSeasonId =
      rawSeasonId === null ? null : normalizeSeasonId(String(rawSeasonId ?? ""));

    if (
      record.schemaVersion !== MATCH_RECORDING_SCHEMA_VERSION ||
      accountKey !== expectedAccountKey ||
      !Number.isFinite(startedAt) ||
      startedAt < 0 ||
      (rawSeasonId !== null && startSeasonId === null)
    ) {
      return null;
    }

    return {
      accountKey: expectedAccountKey,
      schemaVersion: MATCH_RECORDING_SCHEMA_VERSION,
      startedAt,
      startSeasonId,
    };
  } catch {
    return null;
  }
};

export function createMatchRecordingRepository(
  driver: MatchRecordingDriver
): MatchRecordingRepository {
  const writes = new Map<string, Promise<void>>();

  const load = async (accountKey: string) => {
    const normalizedAccountKey = normalizeAccountKey(accountKey);
    if (!normalizedAccountKey) return null;
    await writes.get(normalizedAccountKey);
    const payload = await driver.read(normalizedAccountKey);
    return payload ? parseBaseline(payload, normalizedAccountKey) : null;
  };

  const serialize = async <T>(
    accountKey: string,
    operation: () => Promise<T>
  ): Promise<T> => {
    const current = writes.get(accountKey) ?? Promise.resolve();
    const result = current.then(operation);
    const tail = result.then(
      () => undefined,
      () => undefined
    );
    writes.set(accountKey, tail);
    try {
      return await result;
    } finally {
      if (writes.get(accountKey) === tail) writes.delete(accountKey);
    }
  };

  const ensure: MatchRecordingRepository["ensure"] = async (
    accountKey,
    now = Date.now()
  ) => {
    const normalizedAccountKey = normalizeAccountKey(accountKey);
    if (!normalizedAccountKey || !Number.isFinite(now) || now < 0) return null;

    return serialize(normalizedAccountKey, async () => {
      const payload = await driver.read(normalizedAccountKey);
      const current = payload
        ? parseBaseline(payload, normalizedAccountKey)
        : null;
      if (current) return { baseline: current, created: false };

      const baseline: MatchRecordingBaseline = {
        accountKey: normalizedAccountKey,
        schemaVersion: MATCH_RECORDING_SCHEMA_VERSION,
        startedAt: now,
        startSeasonId: null,
      };
      await driver.write(normalizedAccountKey, JSON.stringify(baseline));
      return { baseline, created: true };
    });
  };

  const bindSeason: MatchRecordingRepository["bindSeason"] = async (
    accountKey,
    seasonId
  ) => {
    const normalizedAccountKey = normalizeAccountKey(accountKey);
    const normalizedSeasonId = normalizeSeasonId(seasonId);
    if (!normalizedAccountKey || !normalizedSeasonId) return null;

    return serialize(normalizedAccountKey, async () => {
      const payload = await driver.read(normalizedAccountKey);
      const current = payload
        ? parseBaseline(payload, normalizedAccountKey)
        : null;
      if (!current || current.startSeasonId) return current;

      const next: MatchRecordingBaseline = {
        ...current,
        startSeasonId: normalizedSeasonId,
      };
      await driver.write(normalizedAccountKey, JSON.stringify(next));
      return next;
    });
  };

  return { bindSeason, ensure, load };
}

const seasonStartTime = (season: LeaderboardSeasonOption) => {
  const value = Date.parse(season.startTime);
  return Number.isFinite(value) ? value : null;
};

export const isRecordingStartSeason = (
  season: LeaderboardSeasonOption,
  baseline: MatchRecordingBaseline
) => {
  const seasonId = normalizeSeasonId(season.id);
  return baseline.startSeasonId
    ? seasonId === baseline.startSeasonId
    : season.isActive;
};

export const getRecordedSeasonStartTime = (
  season: LeaderboardSeasonOption,
  baseline: MatchRecordingBaseline
) => {
  const parsedStartTime = seasonStartTime(season) ?? baseline.startedAt;
  return isRecordingStartSeason(season, baseline)
    ? Math.max(parsedStartTime, baseline.startedAt)
    : parsedStartTime;
};

export const filterRecordedSeasonOptions = (
  seasons: readonly LeaderboardSeasonOption[],
  baseline: MatchRecordingBaseline
) =>
  seasons.filter((season) => {
    if (isRecordingStartSeason(season, baseline)) return true;
    const startTime = seasonStartTime(season);
    return startTime !== null && startTime >= baseline.startedAt;
  });

export const filterRecordedMatches = (
  matches: readonly MatchHistoryRecord[],
  baseline: MatchRecordingBaseline
) =>
  matches.filter(
    (match) =>
      Number.isFinite(match.GameStartTime) &&
      match.GameStartTime >= baseline.startedAt
  );
